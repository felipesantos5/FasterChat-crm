export interface CustomFieldDefinition {
  id: string;
  label: string;
  name: string;
  type: 'text' | 'number' | 'date';
  required: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerCustomFieldValue {
  id: string;
  customerId: string;
  fieldId: string;
  value: string | null;
  field: CustomFieldDefinition;
}
