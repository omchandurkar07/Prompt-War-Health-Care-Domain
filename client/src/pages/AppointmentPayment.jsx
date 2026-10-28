import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const loadRazorpay = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true);
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

const AppointmentPayment = () => {
  const { aid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checkout, setCheckout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    axios.post(`/api/payments/order/${aid}`)
      .then(({ data }) => {
        if (!active) return;
        if (!data?.ok) throw new Error(data?.error || 'Unable to start checkout.');
        setCheckout(data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.error || requestError.message || 'Unable to start checkout.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [aid]);

  const handleSimulation = async (result) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const endpoint = result === 'paid' ? 'simulate' : 'fail';
      const { data } = await axios.post(`/api/payments/${endpoint}/${aid}`, {
        payment_mode: 'simulation'
      });
      if (!data?.ok) throw new Error(data?.error || 'Unable to update the simulated payment.');
      if (result === 'paid') {
        setMessage(data.message || 'Demo payment recorded. No money was charged.');
        setTimeout(() => navigate('/dashboard#appointments'), 1200);
      } else {
        setMessage(data.message);
        setCheckout(null);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || 'Unable to update the simulated payment.');
    } finally {
      setBusy(false);
    }
  };

  const openRazorpay = async () => {
    if (!checkout || checkout.payment_mode !== 'razorpay') return;
    setBusy(true);
    setError('');
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Razorpay Checkout could not be loaded. Check your connection and try again.');
      const paymentWindow = new window.Razorpay({
        key: checkout.key_id,
        amount: checkout.amount,
        currency: checkout.currency,
        name: 'UltraCare',
        description: 'Healthcare appointment',
        order_id: checkout.order_id,
        prefill: { name: user?.full_name || '', email: user?.email || '' },
        notes: { appointment_id: aid },
        theme: { color: '#0f766e' },
        handler: async (gatewayResponse) => {
          try {
            const response = await axios.post(`/api/payments/verify/${aid}`, gatewayResponse);
            if (!response.data?.ok) throw new Error(response.data?.error || 'Payment verification is pending.');
            setMessage('Payment confirmed.');
            setTimeout(() => navigate('/dashboard#appointments'), 1200);
          } catch (verificationError) {
            setError(verificationError.response?.data?.error || verificationError.message || 'Payment confirmation is pending. Check payment history before retrying.');
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) }
      });
      paymentWindow.on('payment.failed', async (event) => {
        try {
          const response = await axios.post(`/api/payments/fail/${aid}`, {
            payment_mode: 'razorpay',
            razorpay_payment_id: event.error?.metadata?.payment_id || ''
          });
          setMessage(response.data?.message || 'Payment failed. Your doctor has been notified and can reschedule.');
          setCheckout(null);
        } catch (failureError) {
          setError(failureError.response?.data?.error || failureError.message || 'Payment failed, but the doctor could not be notified.');
        } finally {
          setBusy(false);
        }
      });
      paymentWindow.open();
    } catch (paymentError) {
      setError(paymentError.message || 'Unable to open Razorpay Checkout.');
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '720px', padding: '48px 20px' }}>
      <div className="glass" style={{ padding: '30px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>Appointment payment</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Your appointment is booked. Complete payment now to finalize it.
        </p>

        {loading && <p role="status">Preparing secure checkout…</p>}
        {!loading && checkout && (
          <>
            <p style={{ fontSize: '1.4rem', fontWeight: 800, margin: '22px 0' }}>
              Amount: ₹{(checkout.amount / 100).toFixed(2)}
            </p>
            {checkout.payment_mode === 'simulation' ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '18px', textAlign: 'left' }}>
                <strong>Demo payment simulation</strong>
                <p style={{ margin: '8px 0 16px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No money will be charged. Choose a result to test the payment flow.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button className="btn btn-success" disabled={busy} onClick={() => handleSimulation('paid')}>
                    {busy ? 'Processing…' : 'Simulate successful payment'}
                  </button>
                  <button className="btn btn-outline" disabled={busy} onClick={() => handleSimulation('failed')}>
                    Simulate payment failure
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn-primary" disabled={busy} onClick={openRazorpay}>
                {busy ? 'Opening checkout…' : 'Continue to secure payment'}
              </button>
            )}
          </>
        )}

        {error && <div className="alert alert-danger" role="alert" style={{ marginTop: '18px' }}>{error}</div>}
        {message && <div className="alert alert-info" role="status" style={{ marginTop: '18px' }}>{message}</div>}
        <div style={{ marginTop: '22px' }}>
          <Link to="/dashboard#appointments">Return to dashboard</Link>
        </div>
      </div>
    </div>
  );
};

export default AppointmentPayment;
