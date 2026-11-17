import "leaflet/dist/leaflet.css"
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet"

function ClickPicker({ onPick }: { onPick?: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick?.(e.latlng.lat, e.latlng.lng) })
  return null
}

/** Bản đồ OpenStreetMap một điểm; truyền onPick để chọn tọa độ bằng cách bấm. */
export function PlaceMap({ lat, lon, height = 260, onPick }: { lat: number; lon: number; height?: number; onPick?: (lat: number, lon: number) => void }) {
  return (
    <div className="overflow-hidden rounded-lg border" style={{ height }}>
      <MapContainer key={onPick ? "pick" : `${lat},${lon}`} center={[lat, lon]} zoom={15} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <CircleMarker center={[lat, lon]} radius={9} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#d0021b", fillOpacity: 1 }} />
        <ClickPicker onPick={onPick} />
      </MapContainer>
    </div>
  )
}
