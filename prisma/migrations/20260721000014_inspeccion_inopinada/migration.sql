-- Inspección inopinada: la visita de control que se agenda al renovar la
-- licencia, en una fecha al azar dentro del año.
--
-- Va sola en su archivo: PostgreSQL permite agregar un valor a un enum dentro
-- de una transacción, pero no USARLO en esa misma transacción, y Prisma
-- envuelve cada migración en una. Mismo motivo que 20260721000009_caja_estados.
ALTER TYPE "InspectionNumber" ADD VALUE 'UNANNOUNCED';
