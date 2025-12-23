export const TAG_COLORS: Record<string, string> = {
  VIP: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Novo: 'bg-blue-100 text-blue-800 border-blue-200',
  Premium: 'bg-green-100 text-green-800 border-green-200',
  Ativo: 'bg-green-100 text-green-800 border-green-200',
  Inativo: 'bg-gray-100 text-gray-800 border-gray-200',
  Lead: 'bg-orange-100 text-orange-800 border-orange-200',
  Cliente: 'bg-teal-100 text-teal-800 border-teal-200',
  Prospect: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Importante: 'bg-red-100 text-red-800 border-red-200',
};

export const getTagColor = (tag: string): string => {
  return TAG_COLORS[tag] || 'bg-slate-100 text-slate-800 border-slate-200';
};
