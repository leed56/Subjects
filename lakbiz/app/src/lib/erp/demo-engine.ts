import type {
  DemoCommand,
  DemoJournalLine,
  DemoShipment,
  DemoState,
} from "./demo-types";
import type { DemoRole } from "./industry-templates";

export const ACCOUNTS = [
  "Cash",
  "Card clearing",
  "Receivables",
  "Inventory",
  "Input VAT",
  "Payables",
  "Output VAT",
  "Sales",
  "COGS",
  "Stock loss",
  "Loyalty expense",
  "Opening equity",
] as const;
export function toMinor(value: number) {
  if (!Number.isFinite(value) || value < 0)
    throw new Error("Enter a valid non-negative amount.");
  return Math.round(value * 100);
}
export function totalStock(p: DemoState["products"][number]) {
  return Object.values(p.quantities).reduce((a, b) => a + b, 0);
}
export function money(value: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2,
  }).format(value / 100);
}
export function businessDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function balanced(lines: DemoJournalLine[]) {
  return (
    lines.length >= 2 &&
    lines.every(
      (l) =>
        ACCOUNTS.includes(l.account as (typeof ACCOUNTS)[number]) &&
        Number.isSafeInteger(l.debit) &&
        Number.isSafeInteger(l.credit) &&
        l.debit >= 0 &&
        l.credit >= 0 &&
        !(l.debit && l.credit),
    ) &&
    lines.reduce((s, l) => s + l.debit - l.credit, 0) === 0 &&
    lines.some((l) => l.debit > 0)
  );
}
/** Largest remainder allocation preserves every minor unit, including rounding. */
export function allocateCost(total: number, weights: number[]): number[] {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !weights.length ||
    weights.some((w) => !Number.isFinite(w) || w <= 0)
  )
    throw new Error("Invalid allocation basis.");
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (total * w) / sum),
    result = exact.map(Math.floor);
  const order = exact
    .map((n, i) => ({ i, r: n - result[i] }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (
    let n = 0, left = total - result.reduce((a, b) => a + b, 0);
    n < left;
    n++
  )
    result[order[n].i]++;
  return result;
}
export function landedCost(
  shipment: Omit<DemoShipment, "id" | "status"> | DemoShipment,
) {
  const goods = toMinor(shipment.foreignGoods * shipment.exchangeRate);
  const capitalized =
    goods +
    shipment.freight +
    shipment.duty +
    shipment.insurance +
    shipment.clearing;
  const weights = shipment.lines.map((l) =>
    shipment.basis === "quantity" ? l.quantity : l.quantity * l.unitAmount,
  );
  return {
    goods,
    capitalized,
    totalPayable: capitalized + shipment.recoverableVat,
    allocations: allocateCost(capitalized, weights),
  };
}
const OWNER_COMMANDS = new Set([
  "purchase",
  "receive_purchase",
  "shipment",
  "advance_shipment",
  "journal",
  "staff",
  "settings",
]);
/** Deterministic business engine shared by all sample industries. No network or auth API calls. */
export function executeDemoCommand(
  current: DemoState,
  command: DemoCommand,
  role: DemoRole,
  now: Date,
  eventId: string,
): DemoState {
  if (!eventId.trim() || current.audit.some((a) => a.id === eventId))
    throw new Error("This action was already recorded.");
  if (OWNER_COMMANDS.has(command.type) && role !== "owner")
    throw new Error("Only the owner can perform this action.");
  if (
    ["return", "write_off", "transfer"].includes(command.type) &&
    role === "cashier"
  )
    throw new Error("Manager or owner access is required.");
  const next = structuredClone(current),
    date = now.toISOString(),
    day = businessDate(now);
  const id = `${command.type}-${eventId}`;
  function product(productId: string) {
    const p = next.products.find((p) => p.id === productId);
    if (!p) throw new Error("Product not found.");
    return p;
  }
  function location(locationId: string) {
    if (!next.warehouses.some((w) => w.id === locationId))
      throw new Error("Location not found.");
  }
  function quantity(n: number) {
    if (
      !Number.isFinite(n) ||
      n <= 0 ||
      n > 1e6 ||
      Math.abs(Math.round(n * 1000) - n * 1000) > 0.000001
    )
      throw new Error("Enter a positive quantity with at most three decimals.");
  }
  function amount(n: number) {
    if (!Number.isSafeInteger(n) || n < 0 || n > 1e12)
      throw new Error("Invalid money amount.");
  }
  function move(
    pid: string,
    qty: number,
    type: DemoState["movements"][number]["type"],
    from?: string,
    to?: string,
    reason?: string,
  ) {
    next.movements.unshift({
      id: `${id}-${next.movements.length}`,
      date,
      productId: pid,
      quantity: qty,
      type,
      from,
      to,
      reference: id,
      reason,
    });
  }
  function journal(reference: string, memo: string, lines: DemoJournalLine[]) {
    const filtered = lines.filter((l) => l.debit || l.credit);
    if (!balanced(filtered)) throw new Error("The journal must balance.");
    next.journals.unshift({
      id: `${id}-journal`,
      date,
      reference,
      memo,
      lines: filtered,
    });
  }
  function take(pid: string, qty: number, warehouseId: string) {
    quantity(qty);
    location(warehouseId);
    const p = product(pid);
    if ((p.quantities[warehouseId] ?? 0) < qty)
      throw new Error(`Insufficient stock for ${p.name}.`);
    p.quantities[warehouseId] = Number(
      (p.quantities[warehouseId] - qty).toFixed(3),
    );
    return p;
  }
  function receive(
    pid: string,
    qty: number,
    cost: number,
    warehouseId: string,
  ) {
    quantity(qty);
    location(warehouseId);
    amount(cost);
    const p = product(pid),
      oldQty = totalStock(p);
    p.cost = Math.round((oldQty * p.cost + cost) / (oldQty + qty));
    p.quantities[warehouseId] = Number(
      ((p.quantities[warehouseId] ?? 0) + qty).toFixed(3),
    );
  }
  if (command.type === "sale") {
    if (!command.lines.length) throw new Error("Add a product to the basket.");
    if (
      new Set(command.lines.map((l) => l.productId)).size !==
      command.lines.length
    )
      throw new Error("Combine duplicate product lines.");
    const customer = next.customers.find((c) => c.id === command.customerId);
    if (command.customerId && !customer) throw new Error("Customer not found.");
    if (!["cash", "card", "credit"].includes(command.payment))
      throw new Error("Choose a valid payment method.");
    const lines = command.lines.map((l) => {
      const p = product(l.productId);
      if (p.blocked || (p.expiry && p.expiry < day))
        throw new Error(`${p.name} is held or expired.`);
      if (
        (p.unit === "unit" || p.unit === "vehicle") &&
        !Number.isInteger(l.quantity)
      )
        throw new Error("Serialized units require whole quantities.");
      take(p.id, l.quantity, command.warehouseId);
      return {
        ...l,
        unitAmount: p.price,
        cost: Math.round(p.cost * l.quantity),
      };
    });
    const gross = lines.reduce(
        (s, l) => s + Math.round(l.quantity * l.unitAmount),
        0,
      ),
      cost = lines.reduce((s, l) => s + (l.cost ?? 0), 0);
    if (!Number.isSafeInteger(command.redeemPoints) || command.redeemPoints < 0)
      throw new Error("Invalid points quantity.");
    if (
      command.redeemPoints &&
      (!customer || customer.points < command.redeemPoints)
    )
      throw new Error("Not enough loyalty points.");
    const discount = command.redeemPoints * next.settings.pointValue;
    if (discount > gross) throw new Error("Points exceed the basket total.");
    const total = gross - discount;
    if (total <= 0) throw new Error("Sale total must be positive.");
    if (
      command.payment === "credit" &&
      (!customer || customer.credit + total > customer.creditLimit)
    )
      throw new Error("Customer credit limit exceeded.");
    const tax = next.settings.vatRegistered
      ? Math.round(
          (total * next.settings.vatRate) / (100 + next.settings.vatRate),
        )
      : 0;
    const earnedPoints = customer
      ? Math.floor(total / next.settings.loyaltySpend)
      : 0;
    if (customer) {
      customer.points += earnedPoints - command.redeemPoints;
      if (command.payment === "credit") customer.credit += total;
    }
    lines.forEach((l) =>
      move(l.productId, l.quantity, "sale", command.warehouseId),
    );
    next.sales.unshift({
      id,
      date,
      customerId: customer?.id,
      lines,
      total,
      tax,
      cost,
      payment: command.payment,
      warehouseId: command.warehouseId,
      returned: false,
      rewardDiscount: discount,
      earnedPoints,
      redeemedPoints: command.redeemPoints,
    });
    journal(id, "Sale and historical cost", [
      {
        account:
          command.payment === "credit"
            ? "Receivables"
            : command.payment === "card"
              ? "Card clearing"
              : "Cash",
        debit: total,
        credit: 0,
      },
      { account: "Sales", debit: 0, credit: total - tax },
      { account: "Output VAT", debit: 0, credit: tax },
      { account: "COGS", debit: cost, credit: 0 },
      { account: "Inventory", debit: 0, credit: cost },
    ]);
  } else if (command.type === "purchase") {
    if (!next.suppliers.some((s) => s.name === command.supplier))
      throw new Error("Supplier not found.");
    quantity(command.quantity);
    amount(command.unitCost);
    location(command.warehouseId);
    product(command.productId);
    if (command.unitCost <= 0) throw new Error("Unit cost must be positive.");
    next.purchases.unshift({
      id,
      date,
      supplier: command.supplier,
      lines: [
        {
          productId: command.productId,
          quantity: command.quantity,
          unitAmount: command.unitCost,
        },
      ],
      status: "ordered",
      total: Math.round(command.quantity * command.unitCost),
      warehouseId: command.warehouseId,
    });
  } else if (command.type === "receive_purchase") {
    const po = next.purchases.find((p) => p.id === command.id);
    if (!po || po.status !== "ordered")
      throw new Error(
        "This order has already been received or is unavailable.",
      );
    po.lines.forEach((l) => {
      receive(
        l.productId,
        l.quantity,
        Math.round(l.quantity * l.unitAmount),
        po.warehouseId,
      );
      move(l.productId, l.quantity, "purchase", undefined, po.warehouseId);
    });
    po.status = "received";
    const sup = next.suppliers.find((s) => s.name === po.supplier);
    if (sup) sup.payable += po.total;
    journal(po.id, "Goods received on account", [
      { account: "Inventory", debit: po.total, credit: 0 },
      { account: "Payables", debit: 0, credit: po.total },
    ]);
  } else if (command.type === "shipment") {
    const s = command.shipment;
    if (
      !s.reference.trim() ||
      !s.supplier.trim() ||
      !s.origin.trim() ||
      s.foreignGoods <= 0 ||
      !Number.isFinite(s.foreignGoods) ||
      !Number.isFinite(s.exchangeRate) ||
      s.exchangeRate <= 0 ||
      !s.lines.length
    )
      throw new Error("Complete the shipment details.");
    if (
      !["USD", "EUR", "LKR"].includes(s.currency) ||
      !["value", "quantity"].includes(s.basis)
    )
      throw new Error("Invalid shipment currency or allocation basis.");
    if (s.currency === "LKR" && s.exchangeRate !== 1)
      throw new Error("LKR exchange rate must be 1.");
    if (!next.suppliers.some((p) => p.name === s.supplier))
      throw new Error("Supplier not found.");
    if (new Set(s.lines.map((l) => l.productId)).size !== s.lines.length)
      throw new Error("Combine duplicate shipment lines.");
    [s.freight, s.duty, s.insurance, s.clearing, s.recoverableVat].forEach(
      amount,
    );
    s.lines.forEach((l) => {
      quantity(l.quantity);
      amount(l.unitAmount);
      if (l.unitAmount <= 0) throw new Error("Line value must be positive.");
      product(l.productId);
    });
    location(s.warehouseId);
    if (
      toMinor(s.foreignGoods) !==
      s.lines.reduce((n, l) => n + Math.round(l.quantity * l.unitAmount), 0)
    )
      throw new Error("Supplier invoice total must match its lines.");
    landedCost(s);
    next.shipments.unshift({
      ...s,
      reference: s.reference.trim(),
      id,
      status: "draft",
    });
  } else if (command.type === "advance_shipment") {
    const s = next.shipments.find((s) => s.id === command.id);
    if (!s || s.status === "received")
      throw new Error("This shipment is already received or unavailable.");
    const stages = ["draft", "in_transit", "customs", "received"] as const;
    s.status = stages[stages.indexOf(s.status) + 1];
    if (s.status === "received") {
      const cost = landedCost(s);
      s.lines.forEach((l, i) => {
        receive(l.productId, l.quantity, cost.allocations[i], s.warehouseId);
        move(l.productId, l.quantity, "purchase", undefined, s.warehouseId);
      });
      const sup = next.suppliers.find((p) => p.name === s.supplier);
      if (sup) sup.payable += cost.totalPayable;
      journal(s.id, "Import receipt: recoverable VAT excluded from inventory", [
        { account: "Inventory", debit: cost.capitalized, credit: 0 },
        { account: "Input VAT", debit: s.recoverableVat, credit: 0 },
        { account: "Payables", debit: 0, credit: cost.totalPayable },
      ]);
    }
  } else if (command.type === "transfer") {
    location(command.to);
    if (command.from === command.to)
      throw new Error("Choose two different locations.");
    const p = take(command.productId, command.quantity, command.from);
    p.quantities[command.to] = Number(
      ((p.quantities[command.to] ?? 0) + command.quantity).toFixed(3),
    );
    move(p.id, command.quantity, "transfer", command.from, command.to);
  } else if (command.type === "write_off") {
    if (!command.reason.trim())
      throw new Error("A reason is required for the audit trail.");
    const p = take(command.productId, command.quantity, command.warehouseId),
      cost = Math.round(p.cost * command.quantity);
    move(
      p.id,
      command.quantity,
      "write_off",
      command.warehouseId,
      undefined,
      command.reason.trim(),
    );
    if (cost)
      journal(id, "Stock loss: " + command.reason, [
        { account: "Stock loss", debit: cost, credit: 0 },
        { account: "Inventory", debit: 0, credit: cost },
      ]);
  } else if (command.type === "return") {
    const sale = next.sales.find((s) => s.id === command.saleId);
    if (!sale || sale.returned)
      throw new Error("This sale has already been returned or is unavailable.");
    if (
      command.disposition !== "restock" &&
      command.disposition !== "quarantine"
    )
      throw new Error("Choose a return disposition.");
    sale.returned = true;
    sale.lines.forEach((l) => {
      if (command.disposition === "restock") {
        const p = product(l.productId);
        p.quantities[sale.warehouseId] = Number(
          ((p.quantities[sale.warehouseId] ?? 0) + l.quantity).toFixed(3),
        );
      }
      move(
        l.productId,
        l.quantity,
        "return",
        undefined,
        command.disposition === "restock" ? sale.warehouseId : "quarantine",
      );
    });
    const customer = next.customers.find((c) => c.id === sale.customerId);
    if (customer) {
      customer.points += sale.redeemedPoints - sale.earnedPoints;
      if (sale.payment === "credit") customer.credit -= sale.total;
    }
    journal(sale.id, "Full credit note / " + command.disposition, [
      { account: "Sales", debit: sale.total - sale.tax, credit: 0 },
      { account: "Output VAT", debit: sale.tax, credit: 0 },
      {
        account:
          sale.payment === "credit"
            ? "Receivables"
            : sale.payment === "card"
              ? "Card clearing"
              : "Cash",
        debit: 0,
        credit: sale.total,
      },
      {
        account: command.disposition === "restock" ? "Inventory" : "Stock loss",
        debit: sale.cost,
        credit: 0,
      },
      { account: "COGS", debit: 0, credit: sale.cost },
    ]);
  } else if (command.type === "journal") {
    amount(command.amount);
    if (
      !command.memo.trim() ||
      command.debitAccount === command.creditAccount ||
      command.amount <= 0
    )
      throw new Error("Enter a memo, amount and two different accounts.");
    journal(id, command.memo, [
      { account: command.debitAccount, debit: command.amount, credit: 0 },
      { account: command.creditAccount, debit: 0, credit: command.amount },
    ]);
  } else if (command.type === "customer") {
    if (!command.name.trim()) throw new Error("Customer name is required.");
    amount(command.creditLimit);
    next.customers.unshift({
      id,
      name: command.name.trim(),
      city: command.city.trim(),
      company: command.company,
      credit: 0,
      creditLimit: command.creditLimit,
      points: 0,
      tier: "Member",
    });
  } else if (command.type === "staff") {
    if (
      !command.name.trim() ||
      !command.job.trim() ||
      !["owner", "manager", "cashier"].includes(command.role)
    )
      throw new Error("Complete the staff details.");
    next.staff.unshift({
      id,
      name: command.name.trim(),
      job: command.job.trim(),
      role: command.role,
      location: "Main showroom",
      status: "Invited",
    });
  } else if (command.type === "settings") {
    if (
      !command.name.trim() ||
      !Number.isFinite(command.vatRate) ||
      command.vatRate < 0 ||
      command.vatRate > 100 ||
      !["Business", "Pro"].includes(command.plan)
    )
      throw new Error("Enter a valid name, tax rate and plan.");
    amount(command.loyaltySpend);
    amount(command.pointValue);
    if (command.loyaltySpend <= 0)
      throw new Error("Loyalty spend threshold must be positive.");
    const { type: commandType, ...settings } = command;
    void commandType;
    next.settings = { ...next.settings, ...settings, name: command.name.trim() };
  }
  next.revision++;
  next.audit.unshift({
    id: eventId,
    date,
    actor: role,
    action: command.type.replaceAll("_", " "),
    reference: id,
  });
  return next;
}
export function demoTrialBalance(state: DemoState) {
  return ACCOUNTS.map((account) => {
    const balance = state.journals
      .flatMap((j) => j.lines)
      .filter((l) => l.account === account)
      .reduce((s, l) => s + l.debit - l.credit, 0);
    return {
      account,
      debit: Math.max(balance, 0),
      credit: Math.max(-balance, 0),
    };
  });
}
