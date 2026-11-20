import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useState } from "react";

import { renderReceipt } from "@/features/restaurant/api/restaurantApi";
import { restaurantErrorMessage } from "@/features/restaurant/api/restaurantClient";
import { useRestaurant } from "@/features/restaurant/context/RestaurantContext";

/** Print or share an invoice using the POS Profile's print format. */
export function useReceipt() {
  const { connection, profile } = useRestaurant();
  const [working, setWorking] = useState<"print" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(invoice: { doctype: string; name: string }, action: "print" | "share") {
    if (working) return;
    setWorking(action);
    setError(null);
    try {
      const { html } = await renderReceipt(connection, {
        invoice_doctype: invoice.doctype,
        invoice_name: invoice.name,
        print_format: profile.print_format,
      });
      if (!html?.trim()) throw new Error("The server did not return a receipt for this invoice.");
      if (action === "print") {
        await Print.printAsync({ html });
        return;
      }
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device.");
      const file = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(file.uri, { UTI: "com.adobe.pdf", mimeType: "application/pdf" });
    } catch (caught) {
      setError(restaurantErrorMessage(caught, "Could not prepare the receipt."));
    } finally {
      setWorking(null);
    }
  }

  return {
    working,
    error,
    print: (invoice: { doctype: string; name: string }) => run(invoice, "print"),
    share: (invoice: { doctype: string; name: string }) => run(invoice, "share"),
  };
}
