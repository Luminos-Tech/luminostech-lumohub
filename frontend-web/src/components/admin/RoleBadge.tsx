interface Props { role: string; }

export default function RoleBadge({ role }: Props) {
  if (role === "admin") {
    return <span className="badge bg-primary-100 text-primary-700">Admin</span>;
  }
  return <span className="badge bg-gray-100 text-gray-600">User</span>;
}
