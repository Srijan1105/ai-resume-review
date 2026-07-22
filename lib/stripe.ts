import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
})

export default stripe

