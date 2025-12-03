-- Update provider feature routes to include /providers prefix

UPDATE provider_features SET route = '/providers/my-trainings' WHERE code = 'my_trainings';
UPDATE provider_features SET route = '/providers/my-medical-records' WHERE code = 'my_medical_records';
UPDATE provider_features SET route = '/providers/my-boarding' WHERE code = 'my_boarding';
UPDATE provider_features SET route = '/providers/my-walks' WHERE code = 'my_walks';
UPDATE provider_features SET route = '/providers/my-shelter' WHERE code = 'my_shelter';
UPDATE provider_features SET route = '/providers/my-grooming' WHERE code = 'my_grooming';
UPDATE provider_features SET route = '/providers/my-vaccines' WHERE code = 'my_vaccines';

-- Verify the updates
SELECT code, name, route FROM provider_features ORDER BY code;
