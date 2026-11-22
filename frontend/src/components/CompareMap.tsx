import "leaflet/dist/leaflet.css"
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet"

const DA_NANG_BOUNDS: [[number, number], [number, number]] = [[15.85, 107.75], [16.3, 108.4]]

export type MapPoint = { id: number; lat: number; lon: number; label: string; rank?: number; kind: "pick" | "target" | "both" }

/** Vùng quen của người dùng (tâm, bán kính) và các quán của một mô hình. */
export function CompareMap({ center, radiusKm, points, height = 360 }: { center: { lat: number; lon: number }; radiusKm: number; points: MapPoint[]; height?: number }) {
  const color = { pick: "#6b4fc8", target: "#1a8a3a", both: "#1a8a3a" }
  return (
    <div className="overflow-hidden rounded-lg border" style={{ height }}>
      <MapContainer key={`${center.lat},${center.lon}`} center={[center.lat, center.lon]} zoom={13} minZoom={11} maxBounds={DA_NANG_BOUNDS} maxBoundsViscosity={1}
        scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Circle center={[center.lat, center.lon]} radius={radiusKm * 1000} pathOptions={{ color: "#2a78d6", weight: 1.5, fillOpacity: 0.06, dashArray: "6 6" }} />
        <CircleMarker center={[center.lat, center.lon]} radius={6} pathOptions={{ color: "#fff", weight: 2, fillColor: "#2a78d6", fillOpacity: 1 }}>
          <Tooltip>Tâm vùng quen</Tooltip>
        </CircleMarker>
        {points.map((p) => (
          <CircleMarker key={`${p.kind}${p.id}`} center={[p.lat, p.lon]} radius={p.kind === "pick" ? 8 : 10}
            pathOptions={{ color: p.kind === "both" ? "#6b4fc8" : "#fff", weight: p.kind === "both" ? 4 : 2, fillColor: color[p.kind], fillOpacity: 1 }}>
            <Tooltip>{p.rank ? `${p.rank}. ` : ""}{p.label}{p.kind !== "pick" ? " (thực tế đã đến)" : ""}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
