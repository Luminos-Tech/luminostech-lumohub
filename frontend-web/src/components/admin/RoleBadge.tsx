interface Props { role: string; }

export default function RoleBadge({ role }: Props) {
  if (role === "admin") {
    return <span className="badge bg-indigo-100 text-indigo-700">Admin</span>;
  }
  return <span className="badge bg-gray-100 text-gray-600">User</span>;
}
