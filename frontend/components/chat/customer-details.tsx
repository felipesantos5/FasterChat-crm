'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Phone, Mail, Tag, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface CustomerDetailsProps {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerTags?: string[];
}

export function CustomerDetails({
  customerId,
  customerName,
  customerPhone,
  customerEmail,
  customerTags = [],
}: CustomerDetailsProps) {
  return (
    <div className="flex flex-col h-full p-4 space-y-4 overflow-y-auto">
      {/* Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Informações do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="text-sm font-medium truncate">{customerName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="text-sm font-medium">{customerPhone}</p>
            </div>
          </div>

          {customerEmail && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium truncate">{customerEmail}</p>
              </div>
            </div>
          )}

          {customerTags.length > 0 && (
            <div className="flex items-start gap-2">
              <Tag className="h-4 w-4 text-muted-foreground mt-1" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {customerTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ações</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href={`/dashboard/customers/${customerId}`}>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Perfil Completo
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Status</span>
            <Badge variant="secondary" className="text-xs">
              Ativo
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Fonte</span>
            <span className="text-xs font-medium">WhatsApp</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
