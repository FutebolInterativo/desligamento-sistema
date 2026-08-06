-- =============================================================================
-- Adiciona o tipo de documento "contrato_atual": o contrato vigente do
-- colaborador que está sendo desligado, anexado pelo RH no momento em que
-- solicita o distrato ao advogado. Esse arquivo vai como anexo no e-mail de
-- solicitação, junto com o link do formulário.
-- =============================================================================

alter type tipo_documento add value if not exists 'contrato_atual';