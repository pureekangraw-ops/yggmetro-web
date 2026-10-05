const PRE_MONEY_STATUSES=new Set(['QUOTE_DRAFT','QUOTE_SENT','PAYMENT_PENDING']);

function safe(value){
  const text=String(value??'').trim();
  return text||'—';
}

export function paymentNeedsGoReview(payment={}){
  const status=safe(payment.status).toUpperCase();
  const freshness=safe(payment.evidenceFreshness?.state).toUpperCase();
  return !PRE_MONEY_STATUSES.has(status)||freshness!=='FRESH';
}

export function paymentMonitorLines(payment={},displayTime=safe){
  const when=value=>value?displayTime(value):'—';
  return [
    `Payment ${safe(payment.paymentId)} · Quote ${safe(payment.quoteId)}`,
    `Customer ${safe(payment.customerId)} · Job/Work ${safe(payment.jobId||payment.workId)}`,
    `Amount ${safe(payment.amount)} ${safe(payment.currency)}`,
    `Provider ref ${safe(payment.providerReference)} · Event ${safe(payment.providerEventId)}`,
    `Owner source ${safe(payment.ownerSource)} · Observed ${when(payment.providerObservedAt)}`,
    `Paid ${when(payment.paidAt)} · Failed ${when(payment.failedAt)}`,
    `Refund pending ${when(payment.refundPendingAt)} · Refunded ${when(payment.refundedAt)}`,
    `Disputed ${when(payment.disputedAt)}`,
    `Fulfillment ${safe(payment.fulfillmentReadiness)}`,
    `Evidence ${safe(payment.evidenceFreshness?.state)} · age ${safe(payment.evidenceFreshness?.ageSeconds)}s`,
    `Next ${safe(payment.nextAction)}`
  ];
}
