// Pega a localização atual do navegador (API nativa do browser, sem
// nenhuma biblioteca extra). Usado pela regra de "melhor mercado" em
// Home.jsx e pelo filtro "Mais próximos" em Explorar.jsx.
//
// Só vale a pena chamar isso depois de conferir
// consumer_profiles.aceite_localizacao (o consentimento já coletado no
// Cadastro.jsx) — ver comentário em Home.jsx sobre onde essa checagem
// acontece. Resolve com `null` (nunca rejeita) em qualquer caso de falha —
// sem geolocalização disponível, sem permissão do usuário, navegador sem
// suporte, timeout — porque a regra de distância é só um "extra": sem
// coordenada, as telas caem de volta para a ordenação por mais recentes já
// existente antes desta função existir.
export function obterLocalizacaoAtual() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        resolve({
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
        })
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    )
  })
}
