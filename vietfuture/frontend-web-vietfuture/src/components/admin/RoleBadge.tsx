interface Props { role: string; }

export default function RoleBadge({ role }: Props) {
  if (role === "admin") {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-primary-100 text-primary-700">Admin</span>;
  }
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-gray-100 text-gray-600">User</span>;
}
