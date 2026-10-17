import { getPosStatusPresentation } from "@/features/pos/status";

describe("POS status presentation", () => {
  it("uses an enabled workflow state ahead of the ERP document status", () => {
    expect(
      getPosStatusPresentation({
        status: "To Deliver and Bill",
        workflowEnabled: true,
        workflowState: "Pending approval",
      }),
    ).toEqual({ label: "Pending approval", tone: "workflow" });
  });

  it("classifies ERPNext Sales Order fulfillment statuses as warnings", () => {
    expect(getPosStatusPresentation({ status: "To Deliver" })).toEqual({
      label: "To Deliver",
      tone: "warning",
    });
  });
});
