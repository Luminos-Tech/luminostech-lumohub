"use client";
/**
 * Web Push Notification Client
 * 管理浏览器 Web Push 订阅生命周期
 */

const API_BASE = "/api/v1/push";

/**
 * 检查浏览器是否支持 Web Push
 */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * 获取当前通知权限状态
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * 请求通知权限
 * @returns true 如果用户授权
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

/**
 * 生成 VAPID 订阅
 * @param publicKey 后端提供的 VAPID 公钥
 */
async function urlBase64ToUint8Array(base64String: string): Promise<Uint8Array> {
  if (!base64String || typeof base64String !== "string" || base64String.trim().length === 0) {
    throw new Error("Invalid VAPID public key: key is empty or not a string");
  }

  // Remove any whitespace
  const cleaned = base64String.trim();

  // Validate that it only contains valid URL-safe base64 characters
  if (!/^[A-Za-z0-9_-]+$/.test(cleaned)) {
    throw new Error("Invalid VAPID public key: contains invalid characters");
  }

  const padding = "=".repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = (cleaned + padding).replace(/-/g, "+").replace(/_/g, "/");

  try {
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (e) {
    throw new Error(`Invalid VAPID public key: failed to decode base64 - ${e}`);
  }
}

/**
 * 订阅 Web Push
 * @param publicKey VAPID 公钥
 * @returns 订阅信息（用于发送到后端）
 */
export async function subscribeToPush(publicKey: string): Promise<PushSubscriptionJSON | null> {
  if (!isPushSupported()) return null;

  // 确认权限
  if (Notification.permission !== "granted") {
    const granted = await requestNotificationPermission();
    if (!granted) return null;
  }

  // 获取 Service Worker 注册
  const registration = await navigator.serviceWorker.ready;
  if (!registration) return null;

  // 订阅
  try {
    const applicationServerKey = await urlBase64ToUint8Array(publicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    return subscription.toJSON();
  } catch (e) {
    console.error("[Push] Failed to subscribe:", e);
    return null;
  }
}

/**
 * 取消 Web Push 订阅
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      return true;
    }
  } catch {}
  return false;
}

/**
 * 将订阅信息发送到后端保存
 */
export async function registerPushSubscription(
  subscription: PushSubscriptionJSON
): Promise<boolean> {
  try {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${API_BASE}/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 取消订阅（通知后端）
 */
export async function unregisterPushSubscription(
  subscription: PushSubscriptionJSON
): Promise<boolean> {
  try {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${API_BASE}/subscribe`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 获取 VAPID 公钥
 */
export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${API_BASE}/public-key`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey || null;
  } catch {
    return null;
  }
}

/**
 * 完整流程：初始化 Web Push 订阅
 * 自动检查权限、订阅、注册到后端
 */
export async function initPushNotifications(): Promise<{
  success: boolean;
  permission: NotificationPermission | "unsupported";
  alreadySubscribed: boolean;
}> {
  if (!isPushSupported()) {
    return { success: false, permission: "unsupported", alreadySubscribed: false };
  }

  const permission = Notification.permission;

  // 已经授权
  if (permission === "granted") {
    // 检查是否已经有订阅
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      return { success: true, permission, alreadySubscribed: true };
    }
  }

  // 获取公钥
  const publicKey = await getVapidPublicKey();
  if (!publicKey) {
    // 后端未配置 VAPID 密钥，跳过
    return { success: false, permission, alreadySubscribed: false };
  }

  // 订阅
  const subscription = await subscribeToPush(publicKey);
  if (!subscription) {
    return { success: false, permission, alreadySubscribed: false };
  }

  // 注册到后端
  const registered = await registerPushSubscription(subscription);
  return {
    success: registered,
    permission,
    alreadySubscribed: false,
  };
}
