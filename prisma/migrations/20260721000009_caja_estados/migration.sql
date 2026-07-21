-- Estados nuevos del turno de caja: la apertura ahora también espera al
-- administrador (PENDING_OPEN) y puede quedar rechazada (REJECTED).
--
-- Va en una migración aparte de la que cambia el DEFAULT a propósito.
-- PostgreSQL permite agregar un valor a un enum dentro de una transacción,
-- pero no USARLO en esa misma transacción: Prisma envuelve cada archivo de
-- migración en una, así que agregar el valor y ponerlo de DEFAULT en el mismo
-- archivo falla con "unsafe use of new value of enum type".
ALTER TYPE "CashSessionStatus" ADD VALUE 'PENDING_OPEN';
ALTER TYPE "CashSessionStatus" ADD VALUE 'REJECTED';
