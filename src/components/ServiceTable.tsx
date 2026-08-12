import { ServiceInfo } from "@/domain/server";

export function ServiceTable({ services }: { services: ServiceInfo[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {services.map((service) => (
            <tr key={service.name}>
              <td className="px-4 py-3 font-medium text-slate-900">{service.name}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-medium capitalize ${
                    service.status === "running" ? "text-emerald-600" : "text-slate-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      service.status === "running" ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                  {service.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
