# Exemplos de Código - Componentes GestãoEklesia
## Código Pronto para Copiar e Colar - Paleta Dark Blue

---

## 📋 Índice
1. [Seções de Formulário](#seções-de-formulário)
2. [Componentes de Input](#componentes-de-input)
3. [Tabelas Completas](#tabelas-completas)
4. [Filtros de Busca](#filtros-de-busca)
5. [Validações](#validações)

---

## Seções de Formulário

### Seção Padrão com Título

```jsx
<div className="bg-white rounded-lg shadow-md p-4 md:p-6">
  <h2 className="text-lg font-bold text-[#123b63] mb-4">
    Identificação
  </h2>
  
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    {/* Campos aqui */}
  </div>
</div>
```

### Seção com Múltiplas Linhas

```jsx
<div className="bg-white rounded-lg shadow-md p-4 md:p-6">
  <h2 className="text-lg font-bold text-[#123b63] mb-4">
    Dados Principais
  </h2>
  
  {/* Linha 1 */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
    {/* Campos da linha 1 */}
  </div>

  {/* Linha 2 */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
    {/* Campos da linha 2 */}
  </div>

  {/* Linha 3 */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {/* Campos da linha 3 */}
  </div>
</div>
```

---

## Componentes de Input

### Input Texto Básico

```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    NOME *
  </label>
  <input
    type="text"
    name="nome"
    value={formData.nome}
    onChange={handleInputChange}
    placeholder="Nome completo"
    required
    className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-blue-50"
  />
</div>
```

### Input com Máscara (CPF)

```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    CPF
  </label>
  <input
    type="text"
    name="cpf"
    value={formData.cpf}
    onChange={(e) => {
      const valor = e.target.value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
      setFormData({ ...formData, cpf: valor });
    }}
    placeholder="XXX.XXX.XXX-XX"
    maxLength="14"
    className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-blue-50"
  />
</div>
```

### Input com Máscara (Telefone)

```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    TELEFONE CELULAR
  </label>
  <input
    type="text"
    name="telefoneCelular"
    value={formData.telefoneCelular}
    onChange={(e) => {
      const valor = e.target.value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
      setFormData({ ...formData, telefoneCelular: valor });
    }}
    placeholder="(XX) XXXXX-XXXX"
    maxLength="15"
    className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-blue-50"
  />
</div>
```

### Input com Máscara (CEP)

```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    CEP
  </label>
  <input
    type="text"
    name="cep"
    value={formData.cep}
    onChange={(e) => {
      const valor = e.target.value
        .replace(/\D/g, '')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{3})\d+?$/, '$1');
      setFormData({ ...formData, cep: valor });
    }}
    placeholder="XXXXX-XXX"
    maxLength="9"
    className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-blue-50"
  />
</div>
```

### Input Data

```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    DATA DE CADASTRO *
  </label>
  <input
    type="date"
    name="dataCadastro"
    value={formData.dataCadastro}
    onChange={handleInputChange}
    required
    className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-blue-50"
  />
</div>
```

### Input Número

```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    ANO
  </label>
  <input
    type="number"
    name="ano"
    value={formData.ano}
    onChange={handleInputChange}
    min="1900"
    max="2100"
    className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-blue-50"
  />
</div>
```

### Select Simples

```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    STATUS
  </label>
  <select
    name="status"
    value={formData.status}
    onChange={handleInputChange}
    className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-white"
  >
    <option value="">Selecione</option>
    <option value="ativo">Ativo</option>
    <option value="inativo">Inativo</option>
  </select>
</div>
```

### Select com Background Blue

```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    TIPO
  </label>
  <select
    name="tipo"
    value={formData.tipo}
    onChange={handleInputChange}
    className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-blue-50"
  >
    <option value="tipo1">Tipo 1</option>
    <option value="tipo2">Tipo 2</option>
  </select>
</div>
```

### Checkbox

```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    Ativo?
  </label>
  <input
    type="checkbox"
    name="ativo"
    checked={formData.ativo}
    onChange={handleInputChange}
    className="w-5 h-5 text-[#123b63] rounded cursor-pointer"
  />
</div>
```

### Checkbox com Label ao Lado

```jsx
<div className="flex items-center gap-3">
  <input
    type="checkbox"
    id="verificado"
    name="verificado"
    checked={formData.verificado}
    onChange={handleInputChange}
    className="w-5 h-5 text-[#123b63] rounded cursor-pointer"
  />
  <label htmlFor="verificado" className="text-xs font-medium text-[#123b63]">
    Verificado?
  </label>
</div>
```

### Textarea

```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    OBSERVAÇÕES
  </label>
  <textarea
    name="observacoes"
    value={formData.observacoes}
    onChange={handleInputChange}
    rows="4"
    placeholder="Digite aqui..."
    className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-blue-50"
  />
</div>
```

### Input File (Imagem)

```jsx
<div>
  <label className="text-xs font-medium text-[#123b63] mb-1 block">
    IMAGEM
  </label>
  <div className="flex items-center gap-4">
    {formData.imagem && (
      <img 
        src={formData.imagem} 
        alt="Preview" 
        className="h-24 w-24 rounded-lg object-cover border-2 border-[#4A6FA5]"
      />
    )}
    <input
      type="file"
      accept="image/*"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setFormData({ ...formData, imagem: event.target?.result });
          };
          reader.readAsDataURL(file);
        }
      }}
      className="text-sm"
    />
  </div>
</div>
```

---

## Tabelas Completas

### Tabela Básica com Ações

```jsx
<div className="bg-white rounded-lg shadow-md overflow-hidden">
  {/* Cabeçalho */}
  <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
    <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
      📋 Listagem
    </h2>
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-600">
        Total: <strong>{dados.length}</strong>
      </span>
      <button 
        onClick={() => window.print()}
        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition text-sm"
      >
        IMPRIMIR
      </button>
    </div>
  </div>

  {/* Tabela */}
  <div className="overflow-x-auto">
    <table className="w-full border-collapse">
      {/* Header */}
      <thead>
        <tr className="bg-blue-100 border-b border-[#4A6FA5]">
          <th className="text-left px-4 py-3 text-xs font-semibold text-[#123b63] border-r border-[#4A6FA5]">#</th>
          <th className="text-left px-4 py-3 text-xs font-semibold text-[#123b63] border-r border-[#4A6FA5]">Nome</th>
          <th className="text-left px-4 py-3 text-xs font-semibold text-[#123b63] border-r border-[#4A6FA5]">Email</th>
          <th className="text-left px-4 py-3 text-xs font-semibold text-[#123b63] border-r border-[#4A6FA5]">Status</th>
          <th className="text-center px-4 py-3 text-xs font-semibold text-[#123b63]">Ações</th>
        </tr>
      </thead>
      
      {/* Body */}
      <tbody>
        {dados.length === 0 ? (
          <tr>
            <td colSpan="5" className="px-4 py-6 text-center text-gray-500">
              Nenhum registro encontrado
            </td>
          </tr>
        ) : (
          dados.map((item) => (
            <tr key={item.id} className="border-b border-gray-200 hover:bg-blue-50 transition">
              <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">{item.id}</td>
              <td className="px-4 py-3 text-sm text-gray-800 font-semibold border-r border-gray-200">{item.nome}</td>
              <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">{item.email}</td>
              <td className="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  item.status === 'ativo' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {item.status}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button className="p-2 text-orange-600 hover:text-orange-800 transition" title="Imprimir">📝</button>
                  <button className="p-2 text-[#0284c7] hover:text-[#0263a0] transition" title="Editar">✏️</button>
                  <button onClick={() => deletar(item.id)} className="p-2 text-red-600 hover:text-red-800 transition" title="Deletar">❌</button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</div>
```

---

## Filtros de Busca

### Filtro Completo em 2 Linhas

```jsx
<div className="bg-blue-50 border border-[#4A6FA5] rounded-lg p-4 md:p-6 mb-6">
  <div className="flex items-center gap-2 mb-4">
    <span className="text-[#123b63] text-xl">🔍</span>
    <h2 className="text-lg font-semibold text-gray-700">Filtro de Busca</h2>
  </div>

  <div className="space-y-4">
    {/* Linha 1 */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="text-xs font-medium text-[#123b63] mb-1 block">TIPO</label>
        <select
          value={searchTipo}
          onChange={(e) => setSearchTipo(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-white"
        >
          <option value="">- Selecione -</option>
          <option value="tipo1">Tipo 1</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-[#123b63] mb-1 block">STATUS</label>
        <select
          value={searchStatus}
          onChange={(e) => setSearchStatus(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-white"
        >
          <option value="">- Selecione -</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-[#123b63] mb-1 block">FILTRO</label>
        <div className="flex gap-2">
          <select
            value={searchFiltro}
            onChange={(e) => setSearchFiltro(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-white"
          >
            <option value="">Selecione</option>
          </select>
          <button
            onClick={() => setSearchFiltro('')}
            className="px-3 py-2 text-gray-500 hover:text-gray-700 text-lg"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    {/* Linha 2 */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="text-xs font-medium text-[#123b63] mb-1 block">BUSCAR</label>
        <input
          type="text"
          placeholder="Digite para buscar..."
          value={searchNome}
          onChange={(e) => setSearchNome(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-white"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[#123b63] mb-1 block">PERÍODO</label>
        <select
          value={searchPeriodo}
          onChange={(e) => setSearchPeriodo(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[#4A6FA5] rounded-lg focus:outline-none focus:border-[#0284c7] bg-white"
        >
          <option value="">- Selecione -</option>
          <option value="hoje">Hoje</option>
          <option value="semana">Esta Semana</option>
          <option value="mes">Este Mês</option>
        </select>
      </div>

      <div className="flex items-end gap-2">
        <button
          onClick={() => {
            setSearchNome('');
            setSearchTipo('');
            setSearchStatus('');
            setSearchFiltro('');
            setSearchPeriodo('');
          }}
          className="flex-1 px-4 py-2 bg-[#123b63] hover:bg-[#0d2a47] text-white rounded-lg font-semibold transition text-sm"
        >
          LIMPAR
        </button>
        <button
          onClick={buscar}
          className="flex-1 px-4 py-2 bg-[#0284c7] hover:bg-[#0263a0] text-white rounded-lg font-semibold transition text-sm"
        >
          BUSCAR
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## Validações

### Validação de Email

```jsx
const validarEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};
```

### Validação de CPF

```jsx
const validarCPF = (cpf: string) => {
  const apenasNumeros = cpf.replace(/\D/g, '');
  if (apenasNumeros.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(apenasNumeros)) return false;
  // Validação de dígitos verificadores...
  return true;
};
```

### Validação de Campo Obrigatório

```jsx
const validarCampoObrigatorio = (valor: string) => {
  return valor && valor.trim().length > 0;
};
```

---

Última atualização: 14 de janeiro de 2026
Versão: 1.0 - GestãoEklesia
