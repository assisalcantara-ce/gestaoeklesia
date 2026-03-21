# 📍 Guia de Preenchimento de Dados - Geolocalização

## Como Popular Membros e Congregações com Coordenadas

---

## 🎯 Objetivo

Este guia mostra como adicionar ou atualizar coordenadas (latitude/longitude) de membros e congregações para que apareçam no mapa de geolocalização.

---

## 📍 Opção 1: Manual (Rápido para Poucos Dados)

### Passo 1: Obter Coordenadas de um Endereço

**Via Google Maps:**
1. Abra [Google Maps](https://maps.google.com)
2. Digite o endereço (ex: "Avenida Getúlio Vargas, 1000, Manaus, AM")
3. Clique no pino vermelho
4. As coordenadas aparecem na URL: `maps.google.com/?q=**-3.1190,-60.0217**`
5. Copie: `latitude = -3.1190` e `longitude = -60.0217`

### Passo 2: Atualizar no Supabase

1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Vá para a tabela `membros`
3. Encontre o membro
4. Edite os campos:
   - `latitude` → Cole o valor (ex: `-3.1190`)
   - `longitude` → Cole o valor (ex: `-60.0217`)
5. Salve (Ctrl+S)

**Exemplo Visual:**
```
Nome:      João Silva
Celular:   (92) 99999-9999
Latitude:  -3.1190
Longitude: -60.0217
Status:    ativo
```

---

## 🔄 Opção 2: SQL (Melhor para Múltiplos Dados)

### Para Membros de Uma Cidade Específica

```sql
-- Manaus, AM
UPDATE membros
SET 
  latitude = '-3.1190',
  longitude = '-60.0217'
WHERE 
  cidade = 'Manaus'
  AND status = 'ativo'
  AND latitude IS NULL;
```

### Para Membros de Uma Congregação

```sql
-- Atualizar membros de uma congregação específica
UPDATE membros
SET 
  latitude = '-3.1190',
  longitude = '-60.0217'
WHERE 
  congregacao = 'Nome da Congregação'
  AND latitude IS NULL;
```

### Para Um Membro Específico

```sql
-- Buscar o ID primeiro
SELECT id, nome, email FROM membros WHERE nome ILIKE '%João%';

-- Depois atualizar
UPDATE membros
SET 
  latitude = '-3.1190',
  longitude = '-60.0217'
WHERE id = 'uuid-do-joao';
```

---

## 📊 Opção 3: Geocoding Automático com Script

### Via API Google Geocoding

**Script Node.js para geocodificar endereços:**

```javascript
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const GOOGLE_MAPS_API_KEY = 'sua-chave-aqui';
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function geocodeAndUpdate() {
  // 1. Buscar membros sem coordenadas
  const { data: membros } = await supabase
    .from('membros')
    .select('id, logradouro, numero, bairro, cidade')
    .is('latitude', null)
    .limit(10);

  for (const membro of membros) {
    // 2. Montar endereço
    const endereco = `${membro.logradouro}, ${membro.numero}, ${membro.bairro}, ${membro.cidade}, Brasil`;
    
    try {
      // 3. Chamar Google Geocoding API
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: {
            address: endereco,
            key: GOOGLE_MAPS_API_KEY
          }
        }
      );

      if (response.data.results[0]) {
        const { lat, lng } = response.data.results[0].geometry.location;
        
        // 4. Atualizar no Supabase
        await supabase
          .from('membros')
          .update({
            latitude: lat.toString(),
            longitude: lng.toString()
          })
          .eq('id', membro.id);

        console.log(`✅ ${membro.nome}: ${lat}, ${lng}`);
      } else {
        console.log(`⚠️ ${membro.nome}: Endereço não encontrado`);
      }
    } catch (error) {
      console.error(`❌ ${membro.nome}: ${error.message}`);
    }

    // Aguardar um pouco para não sobrecarregar a API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Executar
geocodeAndUpdate().catch(console.error);
```

**Como usar:**
```bash
# 1. Criar arquivo geocode.js
# 2. Instalar dependências
npm install axios @supabase/supabase-js

# 3. Configurar variáveis de ambiente
export SUPABASE_URL=sua-url
export SUPABASE_ANON_KEY=sua-chave
export GOOGLE_MAPS_API_KEY=sua-chave-google

# 4. Executar script
node geocode.js
```

---

## 🏢 Opção 4: Congregações

### Adicionar Coordenadas para Congregações

**Via Supabase Editor:**
```
id:        d8f7e6c5-b4a3-2d1e-0f9a-8b7c6d5e4f3a
nome:      Congregação Central
latitude:  -3.1200
longitude: -60.0215
endereco:  Avenida Getúlio Vargas, 1000
cidade:    Manaus
status:    ativo
```

**Via SQL:**
```sql
INSERT INTO congregacoes (id, nome, latitude, longitude, endereco, cidade, status)
VALUES (
  gen_random_uuid(),
  'Congregação Central',
  '-3.1200',
  '-60.0215',
  'Avenida Getúlio Vargas, 1000',
  'Manaus',
  'ativo'
);
```

---

## 📋 Checklist: Preparando Dados

### ✅ Antes de Usar o Módulo de Geolocalização

- [ ] Verifique quantos membros estão sem latitude/longitude
  ```sql
  SELECT COUNT(*) FROM membros WHERE latitude IS NULL OR longitude IS NULL;
  ```

- [ ] Identifique membros com status "ativo"
  ```sql
  SELECT COUNT(*) FROM membros WHERE status = 'ativo';
  ```

- [ ] Verifique se tem campos de endereço preenchidos
  ```sql
  SELECT COUNT(*) FROM membros WHERE logradouro IS NOT NULL AND cidade IS NOT NULL;
  ```

- [ ] Defina uma cidade como padrão para teste
  ```sql
  SELECT DISTINCT cidade FROM membros WHERE cidade IS NOT NULL LIMIT 5;
  ```

- [ ] Atualize pelo menos 3-5 membros com coordenadas válidas

---

## 🗺️ Coordenadas de Exemplo (Manaus, AM)

```
Centro de Manaus:
  Latitude:  -3.1190
  Longitude: -60.0217

Parque Florestal de Adolpho Ducke:
  Latitude:  -2.9246
  Longitude: -59.9754

Encontro das Águas:
  Latitude:  -3.6142
  Longitude: -61.5227

Ponta Negra:
  Latitude:  -3.0569
  Longitude: -60.0568

Zona Franca:
  Latitude:  -3.0169
  Longitude: -59.9822
```

---

## ✅ Como Validar Dados

### Teste 1: Verificar Coordenadas Válidas

```sql
-- Deve retornar membros válidos
SELECT id, nome, latitude, longitude 
FROM membros 
WHERE 
  latitude IS NOT NULL 
  AND longitude IS NOT NULL
  AND latitude::numeric >= -90 
  AND latitude::numeric <= 90
  AND longitude::numeric >= -180 
  AND longitude::numeric <= 180
LIMIT 10;
```

### Teste 2: Verificar Endereços Incompletos

```sql
-- Mostrar membros com dados incompletos
SELECT 
  id, 
  nome, 
  logradouro, 
  numero, 
  bairro, 
  cidade
FROM membros
WHERE 
  logradouro IS NULL 
  OR cidade IS NULL
  OR numero IS NULL;
```

### Teste 3: Contar por Cidade

```sql
-- Ver distribuição por cidade
SELECT 
  cidade,
  COUNT(*) as total,
  COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as com_coordenadas
FROM membros
WHERE status = 'ativo'
GROUP BY cidade
ORDER BY total DESC;
```

---

## 🚀 Próximo Passo: Acessar o Módulo

Após popular os dados:

1. Acesse http://localhost:3000/geolocalizacao
2. Você verá os marcadores no mapa:
   - 🔵 Azuis = Membros
   - 🟠 Laranja = Congregações
3. Use os filtros para visualizar dados
4. Clique nos marcadores para ver detalhes

---

## 🆘 Troubleshooting

### ❌ "Nenhum marcador aparece"

**Solução:**
```sql
-- Verificar quantos membros têm coordenadas
SELECT COUNT(*) FROM membros WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Se resultado for 0, você precisa popular dados!
-- Use uma das opções acima (Manual, SQL ou Script)
```

### ❌ "Coordenadas aparecem mas estão no oceano"

**Verificar:**
```
- Latitude está entre -90 e 90?
- Longitude está entre -180 e 180?
- Verificar sinal de negativo/positivo (Manaus é negativo em ambos)
- Exemplo correto: -3.1190, -60.0217
- Exemplo incorreto: 3.1190, 60.0217
```

### ❌ "Erro ao executar script de geocoding"

**Solução:**
1. Verifique a chave Google Maps é válida
2. Confirme que "Geocoding API" está ativada no Google Cloud
3. Teste com um endereço manualmente em Google Maps
4. Aumente a pausa entre requisições (altere `100` para `500`ms)

---

## 💡 Dicas Finais

1. **Comece pequeno**: Popular 5-10 membros primeiro
2. **Valide os dados**: Teste no Google Maps antes de adicionar
3. **Use coordenadas reais**: Não coloque dados aleatórios
4. **Mantenha consistência**: Use mesmo padrão para todos
5. **Documente**: Anote qual método usou para futura manutenção

---

## 📞 Resumo Rápido

| Método | Velocidade | Complexidade | Melhor Para |
|--------|-----------|--------------|-----------|
| Manual | ⭐ Lenta | ⭐ Fácil | 1-10 registros |
| SQL | ⭐⭐ Rápida | ⭐⭐ Média | 10-100 registros |
| Script | ⭐⭐⭐ Muito Rápida | ⭐⭐⭐ Complexa | 100+ registros |

---

**Pronto? Agora você pode popular o módulo de geolocalização! 🚀**
