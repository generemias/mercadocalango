// Fórmula de Haversine: distância em linha reta (não é rota de carro/a pé)
// entre duas coordenadas — suficiente para ordenar "mercados mais perto" e
// para a regra de "melhor mercado" (distância + itens em promoção, ver
// src/pages/Home.jsx). Não é a mesma distância que o Google Maps mostra na
// rota real (ver "Traçar rota" em MercadoDetalhe.jsx), só uma aproximação
// pra ordenar/exibir dentro do próprio app.
const RAIO_TERRA_KM = 6371

export function calcularDistanciaKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const paraRadianos = (graus) => (graus * Math.PI) / 180

  const deltaLat = paraRadianos(latitudeB - latitudeA)
  const deltaLon = paraRadianos(longitudeB - longitudeA)

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(paraRadianos(latitudeA)) * Math.cos(paraRadianos(latitudeB)) * Math.sin(deltaLon / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return RAIO_TERRA_KM * c
}

// "850 m" para menos de 1km (mais fácil de entender que "0.9 km"), senão
// "2,3 km" — mesma convenção usada em apps de mapa/entrega conhecidos.
export function formatarDistancia(distanciaKm) {
  if (distanciaKm < 1) {
    return `${Math.round(distanciaKm * 1000)} m`
  }
  return `${distanciaKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}
