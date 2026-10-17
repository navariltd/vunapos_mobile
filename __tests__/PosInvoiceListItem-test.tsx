import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

jest.mock("react-native-paper", () => ({
  Text: require("react-native").Text,
}));

import { PosInvoiceListItem } from "@/features/pos/components/PosInvoiceListItem";
import { PosInvoiceListRow, PosInvoiceStatus } from "@/features/pos/types";
import { lightPalette } from "@/theme/tokens";

const onPress = jest.fn();

function makeInvoice(
  overrides: Partial<PosInvoiceListRow> = {},
): PosInvoiceListRow {
  return {
    cashier: "Cashier One",
    creditSale: false,
    currency: "KES",
    customerId: "CUST-001",
    customerName: "Example customer",
    dueDate: undefined,
    invoiceNumber: "POS-INV-0001",
    itemCount: 1,
    openingEntry: "POS-OPEN-0001",
    outstandingAmount: 0,
    paymentMode: "Cash",
    payments: [],
    postedAt: "12/09/2026 · 09:30",
    status: "Paid",
    total: 100,
    ...overrides,
  };
}

describe("PosInvoiceListItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ["Paid", lightPalette.success],
    ["Partly Paid", lightPalette.warning],
    ["Unpaid", lightPalette.warning],
    ["Overdue", lightPalette.error],
    ["Cancelled", lightPalette.error],
    ["Credit Note", lightPalette.error],
  ] as [PosInvoiceStatus, string][])(
    "presents %s with its mapped status colour",
    async (status, color) => {
      const screen = await render(
        <PosInvoiceListItem
          invoice={makeInvoice({ status })}
          onPress={onPress}
        />,
      );

      expect(StyleSheet.flatten(screen.getByText(status).props.style)).toEqual(
        expect.objectContaining({ color }),
      );
    },
  );

  it("renders credit, due-date, outstanding, payment-reference, and precise currency details", async () => {
    const screen = await render(
      <PosInvoiceListItem
        currencyPrecision={3}
        invoice={makeInvoice({
          creditSale: true,
          dueDate: "2026-10-05",
          outstandingAmount: 25.5,
          payments: [
            {
              amount: 74.5,
              mode_of_payment: "M-Pesa",
              transaction_reference: "QWE123",
            },
          ],
          total: 100,
        })}
        onPress={onPress}
      />,
    );

    expect(screen.getByText("Credit sale")).toBeTruthy();
    expect(screen.getByText(/Due .*2026/)).toBeTruthy();
    expect(screen.getByText("M-Pesa · QWE123")).toBeTruthy();
    expect(screen.getByText("KES 74.500")).toBeTruthy();
    expect(screen.getByText("Outstanding KES 25.500")).toBeTruthy();
    expect(screen.getByText("KES 100.000")).toBeTruthy();
  });

  it("uses the payment-request reference and opens its invoice", async () => {
    const screen = await render(
      <PosInvoiceListItem
        invoice={makeInvoice({
          payments: [
            {
              amount: 100,
              ke_payment_request: "REQ-0001",
              mode_of_payment: "M-Pesa",
            },
          ],
        })}
        onPress={onPress}
      />,
    );

    expect(screen.getByText("M-Pesa · REQ-0001")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Open POS-INV-0001"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("labels a credit sale without a deposit and keeps customer fallbacks readable", async () => {
    const screen = await render(
      <PosInvoiceListItem
        invoice={makeInvoice({
          customerId: undefined,
          customerName: "No customer",
          creditSale: true,
          paymentMode: "No deposit",
        })}
        onPress={onPress}
      />,
    );

    expect(screen.getByText("No customer")).toBeTruthy();
    expect(screen.getByText("No deposit")).toBeTruthy();
  });

  it("shows workflow state only for applicable sales orders", async () => {
    const salesOrder = await render(
      <PosInvoiceListItem
        invoice={makeInvoice({
          doctype: "Sales Order",
          outstandingAmount: 25,
          workflowEnabled: true,
          workflowState: "Pending Payment Confirmation",
        })}
        onPress={onPress}
      />,
    );

    expect(salesOrder.getByText("Pending Payment Confirmation")).toBeTruthy();
    expect(salesOrder.queryByText("Paid")).toBeNull();
    expect(salesOrder.queryByText(/Outstanding/)).toBeNull();

    const invoice = await render(
      <PosInvoiceListItem
        invoice={makeInvoice({
          doctype: "POS Invoice",
          workflowState: "Approved",
        })}
        onPress={onPress}
      />,
    );

    expect(invoice.queryByText("Approved")).toBeNull();
  });

  it("does not render an empty workflow badge for a sales order without a state", async () => {
    const screen = await render(
      <PosInvoiceListItem
        invoice={makeInvoice({ doctype: "Sales Order" })}
        onPress={onPress}
      />,
    );

    expect(screen.queryByText("Pending Payment Confirmation")).toBeNull();
    expect(screen.queryByText("Approved")).toBeNull();
  });

  it("uses a compact, order-focused layout for sales orders", async () => {
    const screen = await render(
      <PosInvoiceListItem
        compactSalesOrder
        invoice={makeInvoice({
          cashier: "Cashier One",
          customerId: "CUST-001",
          doctype: "Sales Order",
          invoiceNumber: "SAL-ORD-00042",
          itemCount: 4,
          openingEntry: "POS-OPEN-0001",
          outstandingAmount: 75,
          payments: [
            {
              amount: 25,
              mode_of_payment: "Cash",
            },
          ],
          total: 125,
          workflowEnabled: true,
          workflowState: "Pending Payment Confirmation",
        })}
        onPress={onPress}
      />,
    );

    expect(screen.getByText("SAL-ORD-00042")).toBeTruthy();
    expect(screen.getByText("Example customer")).toBeTruthy();
    expect(screen.getByText("12/09/2026 09:30")).toBeTruthy();
    expect(screen.getByText("Status:")).toBeTruthy();
    expect(screen.getByText("Pending Payment Confirmation")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getByText("KES 125.00")).toBeTruthy();

    expect(screen.queryByText("CUST-001")).toBeNull();
    expect(screen.queryByText(/Cashier:/)).toBeNull();
    expect(screen.queryByText(/Shift:/)).toBeNull();
    expect(screen.queryByText("Cash")).toBeNull();
    expect(screen.queryByText(/Outstanding/)).toBeNull();

    expect(
      StyleSheet.flatten(
        screen.getByText("Pending Payment Confirmation").props.style,
      ),
    ).toEqual(
      expect.objectContaining({
        color: lightPalette.onSurface,
      }),
    );
  });
});
