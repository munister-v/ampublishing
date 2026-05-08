import { Order, PaymentSettings } from '../types';

type OrderEvent = 'order_created' | 'payment_confirmed';

const buildMessage = (event: OrderEvent, order: Order) => {
  const title = event === 'order_created' ? 'New AM Publishing order' : 'Payment confirmed';
  const customerBits = [
    order.customer.name,
    order.customer.email,
    order.customer.phone || '',
    order.customer.location,
  ].filter(Boolean);

  const itemLines = order.items.map(item => `- ${item.quantity} x ${item.bookTitle} (${item.priceAtPurchase.toFixed(2)} ${order.currency})`);

  return [
    title,
    `Order: ${order.id}`,
    `Status: ${order.status}`,
    `Payment: ${order.paymentStatus}`,
    order.paymentReference ? `Reference: ${order.paymentReference}` : '',
    `Total: ${order.total.toFixed(2)} ${order.currency}`,
    `Method: ${order.paymentMethod || 'card'}`,
    `Customer: ${customerBits.join(' • ')}`,
    'Items:',
    ...itemLines,
  ]
    .filter(Boolean)
    .join('\n');
};

export const notifyOrderChannels = async (event: OrderEvent, order: Order, settings: PaymentSettings) => {
  if (!settings.webhookUrl) return false;
  if (event === 'order_created' && !settings.notifyOnOrderCreated) return false;
  if (event === 'payment_confirmed' && !settings.notifyOnPaymentConfirmed) return false;

  const payload = {
    source: 'ampublishing',
    event,
    label: settings.webhookLabel,
    order,
    message: buildMessage(event, order),
    sentAt: new Date().toISOString(),
  };

  try {
    await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'no-cors',
      body: JSON.stringify(payload),
    });
    return true;
  } catch (error) {
    console.warn('Notification webhook failed', error);
    return false;
  }
};
