-- El turno nace pidiendo autorización: nadie abre su propia caja.
--
-- Separado de la migración que agrega el valor al enum; ver el comentario de
-- 20260721000009_caja_estados.
ALTER TABLE "CashSession" ALTER COLUMN "status" SET DEFAULT 'PENDING_OPEN';
