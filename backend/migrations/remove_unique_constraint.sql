-- Remove unique constraint to allow multiple services of the same type per provider
-- This allows providers to manage multiple locations/branches of the same service type

ALTER TABLE provider_services
DROP CONSTRAINT IF EXISTS unique_provider_service_type;

-- Verification query (run after dropping constraint)
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'provider_services';
