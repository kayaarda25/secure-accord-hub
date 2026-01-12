-- Update MGI Media permissions to allow OPEX creation and viewing
UPDATE public.organization_permissions 
SET can_create_opex = true, can_view_opex = true
WHERE org_type = 'mgi_media';