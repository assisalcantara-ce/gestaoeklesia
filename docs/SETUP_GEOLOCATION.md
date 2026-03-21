# Setup - Módulo de Geolocalização

## 1. Instalar Dependências

Execute o seguinte comando para instalar a biblioteca do Google Maps:

```bash
npm install @googlemaps/js-api-loader
```

## 2. Configurar Variável de Ambiente

Adicione ao seu arquivo `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=sua_chave_api_do_google_maps
```

### Como obter a chave:
1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto
3. Ative a API do Google Maps
4. Crie uma chave de API
5. Restrinja a chave para seu domínio (produção) ou deixe sem restrição (desenvolvimento)

## 3. Estrutura de Dados Necessária

O módulo espera que a tabela `membros` no Supabase tenha os seguintes campos:

```sql
- id (UUID)
- nome (TEXT)
- latitude (TEXT/NUMERIC) - Coordenada latitude
- longitude (TEXT/NUMERIC) - Coordenada longitude
- cidade (TEXT)
- bairro (TEXT)
- logradouro (TEXT)
- numero (TEXT)
- status (TEXT) - 'ativo' ou 'inativo'
- tipoCadastro (TEXT) - 'membro', 'congregado', 'ministro', 'crianca'
- congregacao (TEXT) - Opcional
- celular (TEXT) - Opcional
- email (TEXT) - Opcional
- fotoUrl (TEXT) - Opcional
```

Opcional: Se tiver uma tabela `congregacoes`, adicione os mesmos campos de localização.

## 4. Arquivos Criados

- **`src/app/geolocalizacao/page.tsx`** - Página principal com filtros e mapa
- **`src/components/MapaGeolizacao.tsx`** - Componente do mapa interativo
- **`src/lib/geolocation-utils.ts`** - Utilitários e serviços de geolocalização

## 5. Funcionalidades

✅ Mapa interativo com Google Maps
✅ Marcadores para Membros (azul) e Congregações (laranja)
✅ Filtros por nome, cidade, status e tipo
✅ InfoWindow ao clicar nos marcadores
✅ Exportar para KML (Google Earth)
✅ Imprimir mapa
✅ Dashboard com estatísticas
✅ Responsivo e otimizado para dispositivos móveis

## 6. Rotas

- **Menu**: `/geolocalizacao` (já configurado no Sidebar)
- **Componente**: Integrado com o layout da aplicação

## 7. Próximas Melhorias

- [ ] Adicionar busca por endereço com Geocoding
- [ ] Implementar raio de busca geográfica
- [ ] Adicionar heatmap de concentração
- [ ] Integrar com WhatsApp (enviar localização)
- [ ] Adicionar rota entre pontos
- [ ] Dashboard de análise geográfica

## 8. Troubleshooting

### Erro: "Google Maps API key not found"
Verifique se a variável de ambiente `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` está configurada em `.env.local`

### Erro: "Nenhum marcador aparecendo no mapa"
Certifique-se de que:
1. Os membros têm `latitude` e `longitude` preenchidos
2. Os valores não são NULL ou vazios no banco de dados
3. As coordenadas estão no formato correto (números)

### Mapa em branco
Verifique se o contêiner tem altura definida (altura mínima 600px)

---

**Configuração finalizada!** 🎉

Acesse `/geolocalizacao` no menu para usar o módulo.
