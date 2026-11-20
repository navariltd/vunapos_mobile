import { useState } from "react";
import { Button, HelperText, TextInput } from "react-native-paper";

import { verifyManagerPin, type ManagerPinAction } from "@/features/restaurant/api/restaurantApi";
import { restaurantErrorMessage } from "@/features/restaurant/api/restaurantClient";
import { Sheet } from "@/features/restaurant/components/Sheet";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";

/** A manager approves a controlled action with their PIN; returns a one-time token. */
export function ManagerPinSheet({
  action,
  title = "Manager approval",
  description = "A manager enters their PIN to approve this.",
  onApproved,
  onClose,
}: {
  action: ManagerPinAction;
  title?: string;
  description?: string;
  onApproved: (token: string) => void;
  onClose: () => void;
}) {
  const { connection, posProfile } = useRestaurant();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function verify() {
    if (!pin.trim() || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyManagerPin(connection, { pos_profile: posProfile, pin: pin.trim(), action });
      onApproved(result.token);
    } catch (caught) {
      setError(restaurantErrorMessage(caught, "The PIN could not be verified."));
      setPin("");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Sheet
      description={description}
      footer={
        <>
          <Button onPress={onClose}>Cancel</Button>
          <Button disabled={!pin.trim()} loading={verifying} mode="contained" onPress={() => void verify()}>
            Approve
          </Button>
        </>
      }
      onClose={onClose}
      title={title}
      visible
    >
      <TextInput
        autoFocus
        keyboardType="number-pad"
        label="Manager PIN"
        mode="outlined"
        onChangeText={setPin}
        onSubmitEditing={() => void verify()}
        secureTextEntry
        value={pin}
      />
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </Sheet>
  );
}
