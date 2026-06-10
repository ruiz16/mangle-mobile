-- =============================================================================
-- Add oficio to participantes
-- =============================================================================
-- Free-text field for the user's ancestral trade/office.
-- rol remains an enum ('usuario', 'admin', etc.) for system-level user type.
-- oficio is what the person actually does (e.g. "Conchera de Piangua").
-- =============================================================================

ALTER TABLE participantes ADD COLUMN IF NOT EXISTS oficio text NOT NULL DEFAULT '';

COMMENT ON COLUMN participantes.oficio IS 'Oficio ancestral o rol comunitario (texto libre)';

COMMENT ON COLUMN participantes.oficio IS 'Oficio ancestral o rol comunitario (texto libre)';
