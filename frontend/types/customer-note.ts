export interface CustomerNote {
  id: string;
  customerId: string;
  userId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateCustomerNoteRequest {
  customerId: string;
  note: string;
}

export interface UpdateCustomerNoteRequest {
  note: string;
}

export interface CreateCustomerNoteResponse {
  success: boolean;
  data: CustomerNote;
}

export interface GetCustomerNotesResponse {
  success: boolean;
  data: CustomerNote[];
}

export interface UpdateCustomerNoteResponse {
  success: boolean;
  data: CustomerNote;
}

export interface DeleteCustomerNoteResponse {
  success: boolean;
  data: {
    success: boolean;
  };
}
