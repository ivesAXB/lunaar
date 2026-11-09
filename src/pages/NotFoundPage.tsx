import { SearchX } from 'lucide-react';
import { ButtonLink, EmptyState } from '@/components/ui';

export function NotFoundPage({ what = 'Página', back = '/' }: { what?: string; back?: string }) {
  return (
    <div className="page">
      <h1 className="visually-hidden" id="page-title" tabIndex={-1}>
        {what} não encontrado(a)
      </h1>
      <EmptyState icon={<SearchX aria-hidden />} title={`${what} não encontrado(a)`} action={<ButtonLink to={back}>Voltar</ButtonLink>}>
        O endereço pode estar errado, ou o cadastro foi excluído.
      </EmptyState>
    </div>
  );
}
