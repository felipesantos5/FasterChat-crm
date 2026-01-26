'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { MessageFeedback } from '@/types/message';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface MessageFeedbackProps {
  messageId: string;
  currentFeedback?: MessageFeedback | null;
  currentNote?: string | null;
  onFeedbackSubmit: (messageId: string, feedback: 'GOOD' | 'BAD' | null, note?: string) => Promise<void>;
}

export function MessageFeedbackComponent({
  messageId,
  currentFeedback,
  currentNote,
  onFeedbackSubmit,
}: MessageFeedbackProps) {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState(currentNote || '');
  const [submitting, setSubmitting] = useState(false);

  const handleFeedbackClick = async (feedback: 'GOOD' | 'BAD') => {
    // Se clicar no mesmo feedback, remove o feedback (toggle)
    if (currentFeedback === feedback) {
      try {
        setSubmitting(true);
        await onFeedbackSubmit(messageId, null);
      } catch (error) {
        console.error('Error removing feedback:', error);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Se for feedback negativo, abre o modal para nota opcional
    if (feedback === 'BAD') {
      setShowNoteModal(true);
      return;
    }

    // Se for feedback positivo, envia direto
    try {
      setSubmitting(true);
      await onFeedbackSubmit(messageId, feedback);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBadFeedback = async () => {
    try {
      setSubmitting(true);
      await onFeedbackSubmit(messageId, 'BAD', feedbackNote || undefined);
      setShowNoteModal(false);
      setFeedbackNote('');
    } catch (error) {
      console.error('Error submitting bad feedback:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 mt-1">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 w-6 p-0 hover:bg-white/20',
            currentFeedback === MessageFeedback.GOOD && 'text-green-500'
          )}
          onClick={() => handleFeedbackClick('GOOD')}
          disabled={submitting}
        >
          {submitting && currentFeedback !== MessageFeedback.BAD ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ThumbsUp
              className={cn(
                'h-3 w-3',
                currentFeedback === MessageFeedback.GOOD && 'fill-current'
              )}
            />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 w-6 p-0 hover:bg-white/20',
            currentFeedback === MessageFeedback.BAD && 'text-red-500'
          )}
          onClick={() => handleFeedbackClick('BAD')}
          disabled={submitting}
        >
          {submitting && currentFeedback !== MessageFeedback.GOOD ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ThumbsDown
              className={cn(
                'h-3 w-3',
                currentFeedback === MessageFeedback.BAD && 'fill-current'
              )}
            />
          )}
        </Button>
      </div>

      {/* Modal para feedback negativo */}
      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Feedback Negativo</DialogTitle>
            <DialogDescription>
              Você pode adicionar uma nota opcional para nos ajudar a entender o que deu errado com esta resposta da IA.
              Isso será usado para melhorar o treinamento futuro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-note">
                Nota (Opcional)
              </Label>
              <Textarea
                id="feedback-note"
                placeholder="Ex: A resposta foi muito técnica, o cliente esperava uma explicação mais simples."
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNoteModal(false);
                setFeedbackNote('');
              }}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitBadFeedback}
              disabled={submitting}
              variant="destructive"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <ThumbsDown className="h-4 w-4 mr-2" />
                  Enviar Feedback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
