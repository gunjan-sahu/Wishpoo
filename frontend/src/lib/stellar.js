import * as StellarSdk from '@stellar/stellar-sdk'
import { isConnected, requestAccess, getAddress, signTransaction } from '@stellar/freighter-api'

const CONTRACT_ID = (import.meta.env.VITE_CONTRACT_ID || '').trim()
const XLM_TOKEN   = (import.meta.env.VITE_XLM_TOKEN || '').trim()
const NET         = (import.meta.env.VITE_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015').trim()
const RPC_URL     = (import.meta.env.VITE_SOROBAN_RPC_URL    || 'https://soroban-testnet.stellar.org').trim()
const DUMMY       = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'

export const rpc = new StellarSdk.rpc.Server(RPC_URL)

export async function connectWallet() {
  const { isConnected: connected } = await isConnected()
  if (!connected) throw new Error('Freighter not installed.')
  const { address, error } = await requestAccess()
  if (error) throw new Error(error)
  return address
}

async function sendTx(publicKey, op) {
  const account = await rpc.getAccount(publicKey)
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE, networkPassphrase: NET,
  }).addOperation(op).setTimeout(60).build()

  const sim = await rpc.simulateTransaction(tx)
  if (StellarSdk.rpc.Api.isSimulationError(sim)) throw new Error(sim.error)

  const prepared = StellarSdk.rpc.assembleTransaction(tx, sim).build()
  const result = await signTransaction(prepared.toXDR(), { networkPassphrase: NET })
  if (result.error) throw new Error(result.error)
  const signed = StellarSdk.TransactionBuilder.fromXDR(result.signedTxXdr, NET)
  const sent = await rpc.sendTransaction(signed)
  return pollTx(sent.hash)
}

async function pollTx(hash) {
  for (let i = 0; i < 30; i++) {
    const r = await rpc.getTransaction(hash)
    if (r.status === 'SUCCESS') return hash
    if (r.status === 'FAILED')  throw new Error('Transaction failed on-chain')
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error('Transaction timed out')
}

async function readContract(op) {
  const dummy = new StellarSdk.Account(DUMMY, '0')
  const tx = new StellarSdk.TransactionBuilder(dummy, {
    fee: StellarSdk.BASE_FEE, networkPassphrase: NET,
  }).addOperation(op).setTimeout(30).build()
  const sim = await rpc.simulateTransaction(tx)
  return StellarSdk.scValToNative(sim.result.retval)
}

async function approveXlm(publicKey, stroops) {
  const xlm = new StellarSdk.Contract(XLM_TOKEN)
  return sendTx(publicKey, xlm.call(
    'approve',
    StellarSdk.Address.fromString(publicKey).toScVal(),
    StellarSdk.Address.fromString(CONTRACT_ID).toScVal(),
    new StellarSdk.XdrLargeInt('i128', BigInt(stroops)).toI128(),
    StellarSdk.xdr.ScVal.scvU32(3_110_400),
  ))
}

const tc = () => new StellarSdk.Contract(CONTRACT_ID)

export async function makeWish(wisher, text, targetXlm, seedXlm) {
  const target = Math.ceil(targetXlm * 10_000_000)
  const seed   = Math.ceil(seedXlm   * 10_000_000)
  await approveXlm(wisher, seed)
  return sendTx(wisher, tc().call(
    'make_wish',
    StellarSdk.Address.fromString(wisher).toScVal(),
    StellarSdk.xdr.ScVal.scvString(text),
    new StellarSdk.XdrLargeInt('i128', BigInt(target)).toI128(),
    new StellarSdk.XdrLargeInt('i128', BigInt(seed)).toI128(),
    StellarSdk.Address.fromString(XLM_TOKEN).toScVal(),
  ))
}

export async function grantWish(granter, wishId, amountXlm) {
  const stroops = Math.ceil(amountXlm * 10_000_000)
  await approveXlm(granter, stroops)
  return sendTx(granter, tc().call(
    'grant',
    StellarSdk.Address.fromString(granter).toScVal(),
    StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(BigInt(wishId))),
    new StellarSdk.XdrLargeInt('i128', BigInt(stroops)).toI128(),
    StellarSdk.Address.fromString(XLM_TOKEN).toScVal(),
  ))
}

export async function claimWish(wisher, wishId) {
  return sendTx(wisher, tc().call(
    'claim',
    StellarSdk.Address.fromString(wisher).toScVal(),
    StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(BigInt(wishId))),
    StellarSdk.Address.fromString(XLM_TOKEN).toScVal(),
  ))
}

export async function getWish(id) {
  try {
    return await readContract(tc().call(
      'get_wish',
      StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(BigInt(id)))
    ))
  } catch { return null }
}

export async function getRecentIds() {
  try {
    const ids = await readContract(tc().call('get_recent'))
    return Array.isArray(ids) ? [...ids].map(Number).reverse() : []
  } catch { return [] }
}

export async function getWishCount() {
  try {
    return Number(await readContract(tc().call('count')))
  } catch { return 0 }
}

export const xlm   = (s) => (Number(s) / 10_000_000).toFixed(2)
export const short = (a) => a ? `${a.toString().slice(0, 5)}…${a.toString().slice(-4)}` : '—'
export { CONTRACT_ID }


