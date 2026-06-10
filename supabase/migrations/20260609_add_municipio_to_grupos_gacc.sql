-- =============================================================================
-- Add municipio to grupos_gacc
-- =============================================================================
-- Each GACC belongs to a territory (municipio).
-- When creating a GACC, the founder selects the municipio.
-- When joining via code, the municipio comes from the GACC itself.
-- =============================================================================

ALTER TABLE grupos_gacc ADD COLUMN IF NOT EXISTS municipio text NOT NULL DEFAULT '';

COMMENT ON COLUMN grupos_gacc.municipio IS 'Territorio al que pertenece el GACC: guapi o timbiqui';
