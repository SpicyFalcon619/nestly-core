-- ============================================================
-- Keep utility_costs.total_monthly honest.
--
-- The whole product promise is "every cost itemized, and the total is
-- the sum of those costs". Until now total_monthly was just another
-- column the client wrote, so a client that miscalculated (or that was
-- updated to add a new fee) could silently store a total that didn't
-- match its own breakdown.
--
-- A trigger is used rather than a GENERATED ALWAYS column on purpose:
-- a generated column rejects any INSERT that supplies the value, which
-- would break the existing client the moment this migration is applied.
-- The trigger accepts those writes and simply overwrites them, so the
-- migration and the app can be deployed in either order.
-- ============================================================

CREATE OR REPLACE FUNCTION utility_costs_set_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_monthly :=
          COALESCE(NEW.base_rent, 0)
        + COALESCE(NEW.electricity_amount, 0)
        + COALESCE(NEW.gas_bill, 0)
        + COALESCE(NEW.water_bill, 0)
        + COALESCE(NEW.internet_cost, 0)
        + COALESCE(NEW.maintenance_fee, 0)
        + COALESCE(NEW.caretaker_fee, 0)
        + COALESCE(NEW.other_fees, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_utility_costs_set_total ON utility_costs;

CREATE TRIGGER trg_utility_costs_set_total
    BEFORE INSERT OR UPDATE ON utility_costs
    FOR EACH ROW
    EXECUTE FUNCTION utility_costs_set_total();

-- Correct any rows that already drifted.
UPDATE utility_costs SET updated_at = updated_at;
