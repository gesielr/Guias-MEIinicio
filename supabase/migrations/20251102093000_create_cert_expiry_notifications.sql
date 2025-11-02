-- Certificado Digital: Histórico de lembretes de expiração

CREATE TABLE IF NOT EXISTS public.cert_expiry_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES public.cert_enrollments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    days_until_expiry INTEGER NOT NULL,
    notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cert_expiry_notifications_enrollment ON public.cert_expiry_notifications(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_cert_expiry_notifications_user ON public.cert_expiry_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_cert_expiry_notifications_notified_at ON public.cert_expiry_notifications(notified_at);

COMMENT ON TABLE public.cert_expiry_notifications IS 'Auditoria de lembretes enviados para certificados próximos da expiração.';

ALTER TABLE public.cert_expiry_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role pode gerenciar cert_expiry_notifications"
  ON public.cert_expiry_notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

