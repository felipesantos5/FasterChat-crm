# Scripts Utilitários

## assign-first-stage-to-customers.ts

Script para atribuir automaticamente o primeiro estágio do pipeline aos clientes que ainda não têm estágio definido.

### Quando usar?

- Se você tem clientes antigos no sistema que foram criados antes da implementação automática de estágios
- Após importação em lote de clientes
- Para limpar dados inconsistentes

### Como executar?

```bash
# Dentro do diretório backend
npx tsx scripts/assign-first-stage-to-customers.ts
```

### O que o script faz?

1. Busca todas as empresas do sistema
2. Para cada empresa:
   - Identifica o primeiro estágio do pipeline (baseado na ordem)
   - Busca clientes sem estágio (apenas clientes individuais, não grupos)
   - Atualiza todos esses clientes para o primeiro estágio
3. Exibe um relatório de quantos clientes foram atualizados

### Segurança

- ✅ Apenas atualiza clientes sem estágio (não sobrescreve estágios existentes)
- ✅ Apenas atualiza clientes individuais (não afeta grupos)
- ✅ Transações atômicas (tudo ou nada)
- ✅ Logs detalhados de cada operação

### Nota

Este script não é mais necessário para novos clientes, pois a atribuição automática já está implementada no código. Ele serve apenas para migração de dados históricos.
