import React, { useMemo, useEffect, useState, SyntheticEvent } from 'react'
import {
  ethers,
  BigNumber,
  Contract,
  Wallet,
  Signer,
  providers,
  utils
} from 'ethers'
// @ts-ignore
import etherConverter from 'ether-converter'
import InputDecoder from 'ethereum-input-data-decoder'
import nativeAbis from './abi'
import CID from 'cids'

const privateKeyToAddress = require('ethereum-private-key-to-address')
const privateKeyToPublicKey = require('ethereum-private-key-to-public-key')
const publicKeyToAddress = require('ethereum-public-key-to-address')
const base58 = require('bs58') // TODO: types
const contentHash = require('content-hash') // TODO: types
//const namehash = require('eth-ens-namehash') // namehash.hash(...)
const contentHash2 = require('@ensdomains/content-hash')
;(window as any).BigNumber = BigNumber
;(window as any).ethers = ethers
;(window as any).CID = CID
;(window as any).contentHash = contentHash
;(window as any).base58 = base58
;(window as any).contentHash2 = contentHash2

const networkOptions = [
  'mainnet',
  'kovan',
  'goerli',
  'rinkeby',
  'ropsten',
  'polygon',
  'xdai',
  'arbitrum',
  'optimism',
  'injected'
]

function intToHex (value: number) {
  try {
    return BigNumber.from((value || 0).toString()).toHexString()
  } catch (err) {
    return '0x'
  }
}

function getTxExplorerUrl (txHash: string, network: string) {
  let baseUrl = ''
  if (['mainnet', 'kovan', 'goerli', 'rinkeby', 'ropsten'].includes(network)) {
    const subdomain = network === 'mainnet' ? '' : `${network}.`
    baseUrl = `https://${subdomain}etherscan.io`
  } else if (network === 'optimism') {
    baseUrl = 'https://optimistic.etherscan.io'
  } else if (network === 'arbitrum') {
    baseUrl = 'https://arbiscan.io'
  } else if (network === 'polygon') {
    baseUrl = 'https://https://polygonscan.com'
  } else if (network === 'xdai') {
    baseUrl = 'https://blockscout.com/xdai/mainnet'
  } else if (network === 'avalance') {
    baseUrl = 'https://snowtrace.io'
  } else if (network === 'binance') {
    baseUrl = 'https://bscscan.com'
  }
  const path = `/tx/${txHash}`
  return `${baseUrl}${path}`
}

function Fieldset (props: any) {
  const { legend, children } = props
  return (
    <details open>
      <summary>
        <span className='open'>
          {legend} {'▾'}
        </span>
      </summary>
      <fieldset>
        <legend>
          {legend} <span className='close'>{'▴'}</span>
        </legend>
        {children}
      </fieldset>
    </details>
  )
}

function UnitConverter () {
  const [values, setValues] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('converter') || '') || {}
    } catch (err) {
      return {}
    }
  })
  const units = [
    'wei',
    'kwei',
    'mwei',
    'gwei',
    'szabo',
    'finney',
    'ether',
    'kether',
    'mether',
    'gether',
    'tether'
  ]
  useEffect(() => {
    try {
      localStorage.setItem('converter', JSON.stringify(values))
    } catch (err) {
      console.error(err)
    }
  }, [values])

  return (
    <div>
      {units.map((unit, i) => {
        let val = values[unit] ?? ''
        let pow = -18 + i * 3
        let exp = pow ? (
          <>
            10<sup>{pow}</sup>
          </>
        ) : (
          1
        )
        return (
          <div key={unit}>
            <label>
              {unit} ({exp}) {unit === 'gwei' && <small>(gas)</small>}
            </label>
            <div style={{ display: 'flex' }}>
              <div style={{ width: '100%' }}>
                <input
                  type='text'
                  value={val}
                  onChange={(event: any) => {
                    try {
                      const value = event.target.value
                      const result = etherConverter(value, unit)
                      result[unit] = value
                      if (result['wei'] === 'NaN') {
                        setValues({})
                      } else {
                        setValues(result)
                      }
                    } catch (err) {
                      console.error(err)
                    }
                  }}
                />
              </div>
              <div style={{ width: '300px', marginLeft: '1rem' }}>
                {intToHex(val)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CustomTx (props: any = {}) {
  const { wallet } = props
  const cacheKey = 'customTxMethodType'
  const [methodType, setMethodType] = useState<string>(() => {
    return localStorage.getItem(cacheKey) || 'broadcast'
  })
  const [txhash, setTxhash] = useState<any>(null)
  const [result, setResult] = useState('')
  const [tx, setTx] = useState<any>(() => {
    const defaultTx = JSON.stringify(
      {
        to: '',
        value: '',
        data: '',
        gasLimit: '',
        gasPrice: '',
        nonce: ''
      },
      null,
      2
    )
    try {
      return localStorage.getItem('customTx') || defaultTx
    } catch (err) {
      return defaultTx
    }
  })
  const handleChange = (event: any) => {
    const val = event.target.value
    setTx(val)
    localStorage.setItem('customTx', val)
  }
  const updateMethodType = (event: any) => {
    const { value } = event.target
    setMethodType(value)
    localStorage.setItem(cacheKey, value)
  }
  const send = async () => {
    try {
      setTxhash(null)
      setResult('')
      const txData = JSON.parse(tx)
      let res: any
      if (methodType === 'static') {
        res = await wallet.call(txData)
      } else if (methodType === 'populate') {
        res = await wallet.populateTransaction(txData)
      } else if (methodType === 'estimate') {
        res = await wallet.estimateGas(txData)
      } else {
        res = await wallet.sendTransaction(txData)
      }
      setTxhash(res?.hash)
      setResult(JSON.stringify(res, null, 2))
    } catch (err) {
      alert(err.message)
    }
  }

  const txLink = txhash ? getTxExplorerUrl(txhash, props.network) : null

  return (
    <div>
      <div>
        <small>Use hex values</small>
      </div>
      <textarea value={tx} onChange={handleChange} />
      <div>
        <section>
          <label>
            <input
              type='radio'
              value='broadcast'
              checked={methodType === 'broadcast'}
              onChange={updateMethodType}
            />
            broadcast
          </label>

          <label>
            <input
              type='radio'
              value='static'
              checked={methodType === 'static'}
              onChange={updateMethodType}
            />
            call static
          </label>

          <label>
            <input
              type='radio'
              value='populate'
              checked={methodType === 'populate'}
              onChange={updateMethodType}
            />
            populate call
          </label>

          <label>
            <input
              type='radio'
              value='estimate'
              checked={methodType === 'estimate'}
              onChange={updateMethodType}
            />
            estimate gas
          </label>
        </section>
      </div>
      <div>
        <button onClick={send}>send</button>
      </div>
      <pre>{result}</pre>
      {txLink && (
        <a href={txLink} target='_blank' rel='noopener noreferrer'>
          {txLink}
        </a>
      )}
    </div>
  )
}

function Select (props: any = {}) {
  const handleChange = (event: any) => {
    const value = event.target.value
    if (props.onChange) {
      props.onChange(value)
    }
  }
  return (
    <select value={props.selected} onChange={handleChange}>
      {props.options.map((option: any, i: number) => {
        return (
          <option key={i} value={option}>
            {option}
          </option>
        )
      })}
    </select>
  )
}

function TextInput (props: any = {}) {
  const [value, setValue] = useState('')
  const handleChange = (event: any) => {
    const val = event.target.value
    setValue(val)
    if (props.onChange) {
      props.onChange(val)
    }
  }
  useEffect(() => {
    setValue(props.value)
  }, [props.value])
  let el: any
  if (props.variant === 'textarea') {
    el = (
      <textarea
        readOnly={props.readOnly}
        disabled={props.disabled}
        placeholder={props.placeholder}
        value={value || ''}
        onChange={handleChange}
      />
    )
  } else {
    el = (
      <input
        readOnly={props.readOnly}
        disabled={props.disabled}
        placeholder={props.placeholder}
        type='text'
        value={value || ''}
        onChange={handleChange}
      />
    )
  }
  return el
}

function AbiMethodForm (props: any = {}) {
  const cacheKey = JSON.stringify(props.abi)
  const contractAddress = props.contractAddress
  const [args, setArgs] = useState<any>(() => {
    const defaultArgs: any = {}
    try {
      return JSON.parse(localStorage.getItem(cacheKey) as any) || defaultArgs
    } catch (err) {
      return defaultArgs
    }
  })
  const [gasLimit, setGasLimit] = useState<string>(() => {
    return localStorage.getItem('gasLimit') || ''
  })
  const [gasPrice, setGasPrice] = useState<string>(() => {
    return localStorage.getItem('gasPrice') || ''
  })
  const [value, setValue] = useState<string>(() => {
    return localStorage.getItem('value') || ''
  })
  const [fromAddress, setFromAddress] = useState<string>('')
  const [nonce, setNonce] = useState<string>(() => {
    return localStorage.getItem('nonce') || ''
  })
  const [error, setError] = useState<string>('')
  const [result, setResult] = useState('')
  const [callStatic, setCallStatic] = useState<boolean>(() => {
    try {
      return localStorage.getItem('callStatic') === 'true'
    } catch (err) {}
    return false
  })
  const [txhash, setTxhash] = useState<any>(null)
  const [tx, setTx] = useState<any>(null)
  const abiObj = props.abi
  const windowWeb3 = (window as any).ethereum
  const provider = useMemo(() => {
    if (windowWeb3) {
      return new providers.Web3Provider(windowWeb3, 'any')
    }
  }, [windowWeb3])
  useEffect(() => {
    const update = async () => {
      try {
        const address = await provider?.getSigner()?.getAddress()
        setFromAddress(address || '')
      } catch (err) {
        console.error(err)
      }
    }
    update()
  }, [provider, fromAddress, setFromAddress])

  useEffect(() => {
    let tx: any = {
      from: fromAddress ? fromAddress : undefined,
      to: contractAddress ? contractAddress : undefined,
      value: value ? value : undefined,
      gasPrice: gasPrice
        ? utils.parseUnits(gasPrice, 'gwei').toString()
        : undefined,
      gasLimit: gasLimit ? gasLimit : undefined,
      nonce: nonce ? nonce : undefined
    }

    try {
      setError('')
      if (abiObj) {
        const iface = new utils.Interface([abiObj])

        const parsed = args
        for (const key in parsed) {
          const value = parsed[key]
          try {
            const p = JSON.parse(value)
            if (Array.isArray(p)) {
              parsed[key] = p
            }
          } catch (err) {}
        }

        const data = iface.encodeFunctionData(
          abiObj.name,
          Object.values(parsed)
        )
        tx.data = data
      }
    } catch (err) {
      setError(err.message)
    }

    setTx(tx)
  }, [
    abiObj,
    contractAddress,
    gasPrice,
    gasLimit,
    value,
    fromAddress,
    nonce,
    args
  ])

  if (abiObj.type !== 'function') {
    return null
  }

  const handleSubmit = async (event: any) => {
    event.preventDefault()
    try {
      if (error) {
        throw new Error(error)
      }
      if (!contractAddress) {
        throw new Error('contract address is required')
      }
      setTxhash(null)
      setResult('')
      const contract = new Contract(contractAddress, [abiObj], props.wallet)

      const txOpts = {
        gasPrice: tx.gasPrice,
        gasLimit: tx.gasLimit,
        value: tx.value
      }

      const contractArgs = Object.values(args).reduce(
        (acc: any[], val: any, i: number) => {
          if (abiObj.inputs[i].type?.endsWith('[]') && typeof val == 'string') {
            val = val.split(',').map((x: string) => x.trim())
          }
          acc.push(val)
          return acc
        },
        []
      )

      console.log('contract args:', contractArgs)
      const res = await contract[callStatic ? 'callStatic' : 'functions'][
        abiObj.name
      ](...contractArgs, txOpts)
      console.log('result:', result)
      setTxhash(res?.hash)
      setResult(JSON.stringify(res, null, 2))
      if (props.onSubmit) {
        props.onSubmit(res)
      }
    } catch (err) {
      console.error(err)
      alert(err.message)
    }
  }
  const updateGasLimit = (val: string) => {
    setGasLimit(val)
    localStorage.setItem('gasLimit', val)
  }
  const updateGasPrice = (val: string) => {
    setGasPrice(val)
    localStorage.setItem('gasPrice', val)
  }
  const updateValue = (val: string) => {
    setValue(val)
    localStorage.setItem('value', val)
  }
  const updateNonce = (val: string) => {
    setNonce(val)
    localStorage.setItem('nonce', val)
  }
  const updateCallStatic = (event: any) => {
    const { checked } = event.target
    setCallStatic(checked)
    localStorage.setItem('callStatic', checked)
  }

  const txLink = txhash ? getTxExplorerUrl(txhash, props.network) : null
  const stateMutability = abiObj?.stateMutability
  const methodType = abiObj?.type
  const isWritable =
    ['nonpayable', 'payable'].includes(stateMutability) &&
    methodType === 'function'

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label style={{ marginBottom: '0.5rem' }}>
          <strong>{abiObj.name}</strong>{' '}
          {stateMutability ? `(${stateMutability})` : null} (
          {isWritable ? 'writable' : 'read-only'})
        </label>
        {abiObj?.inputs?.map((input: any, i: number) => {
          const convertTextToHex = (event: SyntheticEvent) => {
            event.preventDefault()
            try {
              const newArgs = Object.assign({}, args)
              if (!utils.isHexString(args[i])) {
                newArgs[i] = utils.hexlify(Buffer.from(args[i]))
                localStorage.setItem(cacheKey, JSON.stringify(newArgs))
                setArgs(newArgs)
              }
            } catch (err) {
              alert(err)
            }
          }
          let inputValue = args[i]
          if (Array.isArray(inputValue)) {
            try {
              inputValue = JSON.stringify(inputValue)
            } catch (err) {}
          }
          return (
            <div key={i}>
              <label>
                {input.name} ({input.type}) *{' '}
                {input.type === 'address' && windowWeb3 ? (
                  <button
                    onClick={async (event: SyntheticEvent) => {
                      event.preventDefault()
                      const provider = new providers.Web3Provider(
                        windowWeb3,
                        'any'
                      )
                      const newArgs = Object.assign({}, args)
                      newArgs[i] = await provider?.getSigner()?.getAddress()
                      localStorage.setItem(cacheKey, JSON.stringify(newArgs))
                      setArgs(newArgs)
                    }}
                  >
                    from web3
                  </button>
                ) : null}
                {input.type?.startsWith('bytes') ? (
                  <>
                    <span>
                      (
                      {input.type?.includes('[]')
                        ? 'must be array of hex'
                        : 'must be hex'}
                      )
                    </span>
                    &nbsp;
                    <button onClick={convertTextToHex}>hexlify</button>
                  </>
                ) : null}
              </label>
              <TextInput
                value={inputValue}
                placeholder={input.type}
                onChange={(val: string) => {
                  val = val.trim()
                  const newArgs = Object.assign({}, args)
                  if (input.type === 'address') {
                    if (val) {
                      try {
                        val = utils.getAddress(val)
                      } catch (err) {
                        // noop
                      }
                    }
                  }
                  newArgs[i] = val
                  localStorage.setItem(cacheKey, JSON.stringify(newArgs))
                  setArgs(newArgs)
                }}
              />
            </div>
          )
        })}
        {abiObj?.inputs.length ? <small>* = Required</small> : null}
        <div style={{ padding: '1rem' }}>
          <label style={{ marginBottom: '0.5rem' }}>
            Transaction options (optional)
          </label>
          <label>gas limit</label>
          <TextInput
            value={gasLimit}
            placeholder={'gas limit'}
            onChange={updateGasLimit}
          />
          <label>gas price (gwei)</label>
          <TextInput
            value={gasPrice}
            placeholder={'gas price'}
            onChange={updateGasPrice}
          />
          <label>value (wei)</label>
          <TextInput
            value={value}
            placeholder={'value'}
            onChange={updateValue}
          />
          <label>nonce</label>
          <TextInput
            value={nonce}
            placeholder={'nonce'}
            onChange={updateNonce}
          />
        </div>
        {abiObj?.outputs.length ? (
          <div>
            <label style={{ marginBottom: '0.5rem' }}>Return values</label>
            <ol>
              {abiObj?.outputs?.map((obj: any) => {
                return (
                  <li key={obj.name}>
                    {obj.name} ({obj.type})
                  </li>
                )
              })}
            </ol>
          </div>
        ) : null}
        {tx && (
          <div>
            <label style={{ marginBottom: '0.5rem' }}>Transaction object</label>
            <pre>{JSON.stringify(tx, null, 2)}</pre>
          </div>
        )}
        <div>
          <input
            type='checkbox'
            checked={callStatic}
            onChange={updateCallStatic}
          />
          call static
        </div>
        <div>
          <button type='submit'>Submit</button>
        </div>
      </form>
      <pre>{result}</pre>
      {txLink && (
        <a href={txLink} target='_blank' rel='noopener noreferrer'>
          {txLink}
        </a>
      )}
    </div>
  )
}

function AbiEventForm (props: any = {}) {
  const abiObj = props.abi
  const inputs = abiObj?.inputs || []

  return (
    <div>
      <div style={{ marginBottom: '0.5rem' }}>Event</div>
      <div>
        <label>
          <strong>{abiObj.name}</strong>
        </label>
      </div>
      <ol>
        {inputs.map((input: any, i: number) => {
          return (
            <li key={i}>
              <strong>{input.name}</strong> ({input.type}){' '}
              {input.indexed ? `(indexed)` : null}
            </li>
          )
        })}
      </ol>
      <div>
        <label>Signature</label>
        {abiObj.signature}
      </div>
    </div>
  )
}

function DataDecoder (props: any) {
  const { abi, abiName } = props
  const [inputData, setInputData] = useState(
    localStorage.getItem('decodeInputData') || ''
  )
  const [result, setResult] = useState<any>(null)
  useEffect(() => {
    localStorage.setItem('decodeInputData', inputData || '')
  }, [inputData])
  const decode = () => {
    if (!(abi && abi.length)) {
      throw new Error('abi required')
    }
    const decoder = new InputDecoder(abi)
    const decoded = decoder.decodeData(inputData)
    setResult(decoded)
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    try {
      decode()
    } catch (err) {
      alert(err.message)
    }
  }
  const handleInputDataChange = (value: string) => {
    setInputData(value)
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Decode transaction calldata using <strong>{abiName}</strong> ABI
          </label>
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <label>Input data (hex)</label>
          <TextInput
            value={inputData}
            onChange={handleInputDataChange}
            placeholder='0x'
            variant='textarea'
          />
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>decode</button>
        </div>
      </form>
      <div>
        <pre>{result ? JSON.stringify(result, null, 2) : ''}</pre>
      </div>
    </div>
  )
}

function SendEth (props: any) {
  const { wallet } = props
  const [address, setAddress] = useState<string>('')
  const [balance, setBalance] = useState<string>('')
  const [amount, setAmount] = useState(localStorage.getItem('sendEthAmount'))
  const [recipient, setRecipient] = useState(
    localStorage.getItem('sendEthRecipient')
  )
  const [result, setResult] = useState<any>(null)
  useEffect(() => {
    const update = async () => {
      setAddress('')
      setBalance('')
      if (!wallet) {
        return
      }
      let signer: Signer
      if (wallet._isSigner) {
        signer = wallet
      } else if (wallet.getSigner) {
        signer = await wallet.getSigner()
      } else {
        return
      }
      try {
        const _address = await signer.getAddress()
        setAddress(_address)
        const _balance = await signer.getBalance()
        setBalance(utils.formatUnits(_balance.toString(), 18))
      } catch (err) {
        console.error(err)
      }
    }
    update()
  }, [wallet])
  useEffect(() => {
    localStorage.setItem('sendEthAmount', amount || '')
  }, [amount])
  useEffect(() => {
    localStorage.setItem('sendEthRecipient', recipient || '')
  }, [recipient])
  const handleAmountChange = (value: string) => {
    setAmount(value)
  }
  const handleRecipientChange = (value: string) => {
    setRecipient(value)
  }
  const send = async () => {
    setResult(null)
    if (!amount) {
      throw new Error('amount is required')
    }
    if (!recipient) {
      throw new Error('recipient is required')
    }
    const tx = await wallet.sendTransaction({
      to: recipient,
      value: BigNumber.from(amount)
    })
    setResult(tx)
    tx.wait((receipt: any) => {
      setResult(receipt)
    })
  }
  const handleSubmit = async (event: any) => {
    event.preventDefault()
    try {
      await send()
    } catch (err) {
      alert(err.message)
    }
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Address</label>
          <div>{address}</div>
        </div>
        <div>
          <label>Balance</label>
          <div>{balance} ETH</div>
        </div>
        <div>
          <label>Amount (uint256) *</label>
          <TextInput
            value={amount}
            onChange={handleAmountChange}
            placeholder='uint256'
          />
        </div>
        <div>
          <label>Recipient (address) *</label>
          <TextInput
            value={recipient}
            onChange={handleRecipientChange}
            placeholder='address'
          />
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>send</button>
        </div>
      </form>
      <div>
        <pre>{result ? JSON.stringify(result, null, 2) : ''}</pre>
      </div>
    </div>
  )
}

function TxReceipt (props: any) {
  const { provider } = props
  const [txHash, setTxHash] = useState(localStorage.getItem('txReceiptHash'))
  const [receipt, setReceipt] = useState(null)
  useEffect(() => {
    localStorage.setItem('txReceiptHash', txHash || '')
  }, [txHash])
  const handleTxHashChange = (value: string) => {
    setTxHash(value)
  }
  const getReceipt = async () => {
    try {
      setReceipt(null)
      const _receipt = await provider.getTransactionReceipt(txHash)
      setReceipt(_receipt)
    } catch (err) {
      alert(err.message)
    }
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    getReceipt()
  }
  const result = JSON.stringify(receipt, null, 2)
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Transaction hash</label>
        <TextInput
          value={txHash}
          onChange={handleTxHashChange}
          placeholder='hash'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>get receipt</button>
        </div>
      </form>
      <div>
        <pre>{result}</pre>
      </div>
    </div>
  )
}

function GetBlock (props: any) {
  const { provider } = props
  const [blockNumber, setBlockNumber] = useState(
    localStorage.getItem('blockNumber')
  )
  const [block, setBlock] = useState(null)
  useEffect(() => {
    localStorage.setItem('blockNumber', blockNumber || '')
  }, [blockNumber])
  const handleBlockNumberChange = (value: string) => {
    setBlockNumber(value)
  }
  const getBlock = async () => {
    try {
      setBlock(null)
      const _block = await provider.getBlock(
        blockNumber ? Number(blockNumber) : undefined
      )
      setBlock(_block)
    } catch (err) {
      alert(err.message)
    }
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    getBlock()
  }
  const result = JSON.stringify(block, null, 2)
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>
          Block number <small>(optional)</small>
        </label>
        <TextInput
          value={blockNumber}
          onChange={handleBlockNumberChange}
          placeholder='number'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>get block</button>
        </div>
      </form>
      <div>
        <pre>{result}</pre>
      </div>
    </div>
  )
}

function GetCode (props: any) {
  const { provider } = props
  const [address, setAddress] = useState(localStorage.getItem('getCodeAddress'))
  const [code, setCode] = useState(null)
  useEffect(() => {
    localStorage.setItem('getCodeAddress', address || '')
  }, [address])
  const handleAddressChange = (value: string) => {
    setAddress(value)
  }
  const getCode = async () => {
    setCode(null)
    const _code = await provider.getCode(address)
    setCode(_code)
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    getCode()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Address</label>
        <TextInput
          value={address}
          onChange={handleAddressChange}
          placeholder='0x'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>get code</button>
        </div>
      </form>
      <div>
        <pre>{code}</pre>
      </div>
    </div>
  )
}

function GetFeeData (props: any) {
  const { provider } = props
  const [feeData, setFeeData] = useState<any>(null)
  const getFeeData = async () => {
    setFeeData(null)
    const _feeData = await provider.getFeeData()
    setFeeData(_feeData)
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    getFeeData()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>get fee data</button>
        </div>
      </form>
      <div>{!!feeData && <pre>{JSON.stringify(feeData, null, 2)}</pre>}</div>
    </div>
  )
}

function GetNonce (props: any) {
  const { provider } = props
  const [address, setAddress] = useState(
    localStorage.getItem('getNonceAddress')
  )
  const [nonce, setNonce] = useState<number | null>(null)
  useEffect(() => {
    localStorage.setItem('getNonceAddress', address || '')
  }, [address])
  const handleAddressChange = (value: string) => {
    setAddress(value)
  }
  const getNonce = async () => {
    setNonce(null)
    const _nonce = await provider.getTransactionCount(address, 'pending')
    setNonce(Number(_nonce.toString()))
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    getNonce()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Address</label>
        <TextInput
          value={address}
          onChange={handleAddressChange}
          placeholder='0x'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>get nonce</button>
        </div>
      </form>
      <div>
        {nonce !== null && (
          <pre>
            {nonce} ({intToHex(nonce)})
          </pre>
        )}
      </div>
    </div>
  )
}

function EnsAvatar (props: any) {
  const { provider } = props
  const [loading, setLoading] = useState<boolean>(false)
  const [value, setValue] = useState<string>(
    localStorage.getItem('ensAvatar' || '') || ''
  )
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    localStorage.setItem('ensAvatar', value || '')
  }, [value])
  const handleValueChange = (_value: string) => {
    setValue(_value)
  }
  const encode = async () => {
    try {
      setResult(null)
      setLoading(true)
      let ensName = value
      if (utils.isAddress(value)) {
        ensName = await provider.lookupAddress(value)
      }
      const url = await provider.getAvatar(ensName)
      setResult(url)
    } catch (err) {
      alert(err.message)
    }
    setLoading(false)
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    encode()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>ENS avatar (enter ens name or address)</label>
        <TextInput
          value={value}
          onChange={handleValueChange}
          placeholder='vitalik.eth'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>get avatar</button>
        </div>
      </form>
      <div style={{ marginTop: '1rem' }}>
        {loading && <span>Loading...</span>}
        {!!result && (
          <img src={result} alt='avatar' style={{ maxWidth: '200px' }} />
        )}
      </div>
    </div>
  )
}

function HexCoder (props: any) {
  const [value, setValue] = useState(
    localStorage.getItem('hexCoderValue' || '')
  )
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    localStorage.setItem('hexCoderValue', value || '')
  }, [value])
  const handleValueChange = (_value: string) => {
    setValue(_value)
  }
  const convert = () => {
    try {
      setResult(null)
      if (value?.startsWith('0x')) {
        setResult(BigNumber.from(value).toString())
      } else {
        setResult(BigNumber.from(value).toHexString())
      }
    } catch (err) {
      alert(err.message)
    }
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    convert()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Hex or number</label>
        <TextInput
          value={value}
          onChange={handleValueChange}
          placeholder='0x123'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>convert</button>
        </div>
      </form>
      <div>{result !== null && <pre>{result}</pre>}</div>
    </div>
  )
}

function Base58Coder (props: any) {
  const [encodeValue, setEncodeValue] = useState(
    localStorage.getItem('base58EncodeValue' || '')
  )
  const [decodeValue, setDecodeValue] = useState(
    localStorage.getItem('base58DecodeValue' || '')
  )
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    localStorage.setItem('base58EncodeValue', encodeValue || '')
  }, [encodeValue])
  useEffect(() => {
    localStorage.setItem('base58DecodeValue', decodeValue || '')
  }, [decodeValue])
  const handleEncodeValueChange = (_value: string) => {
    setEncodeValue(_value)
  }
  const handleDecodeValueChange = (_value: string) => {
    setDecodeValue(_value)
  }
  const encode = () => {
    try {
      setResult(null)
      let buf = Buffer.from(encodeValue || '')
      if (encodeValue?.startsWith('0x')) {
        buf = Buffer.from(encodeValue.replace(/^0x/, ''), 'hex')
      }
      const base58content = base58.encode(buf)
      setResult(base58content)
    } catch (err) {
      alert(err.message)
    }
  }
  const decode = () => {
    try {
      setResult(null)
      const base58content = base58.decode(decodeValue)
      setResult(
        `0x${Buffer.from(base58content).toString('hex')}\n${Buffer.from(
          base58content
        ).toString()}`
      )
    } catch (err) {
      alert(err.message)
    }
  }
  const handleEncodeSubmit = (event: any) => {
    event.preventDefault()
    encode()
  }
  const handleDecodeSubmit = (event: any) => {
    event.preventDefault()
    decode()
  }
  return (
    <div>
      <form onSubmit={handleEncodeSubmit}>
        <label>Encode value</label>
        <TextInput
          value={encodeValue}
          onChange={handleEncodeValueChange}
          placeholder='example.com'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>encode</button>
        </div>
      </form>
      <form onSubmit={handleDecodeSubmit}>
        <label>Decode value</label>
        <TextInput
          value={decodeValue}
          onChange={handleDecodeValueChange}
          placeholder='SAQDNQ7MfCiLqDE'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>decode</button>
        </div>
      </form>
      <div>{result !== null && <pre>{result}</pre>}</div>
    </div>
  )
}

function ClearLocalStorage () {
  const handleSubmit = (event: any) => {
    event.preventDefault()
    try {
      localStorage.clear()
      sessionStorage.clear()
      window.location.reload()
    } catch (err) {
      alert(err.message)
    }
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <button type='submit'>Clear local storage</button>
      </form>
    </div>
  )
}

function EnsCoder (props: any) {
  const [value, setValue] = useState<string>(
    localStorage.getItem('namehashValue' || '') || ''
  )
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    localStorage.setItem('namehashValue', value || '')
  }, [value])
  const handleValueChange = (_value: string) => {
    setValue(_value)
  }
  const encode = () => {
    try {
      setResult(null)
      setResult(utils.namehash(value))
    } catch (err) {
      alert(err.message)
    }
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    encode()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>ENS namehash (returns node)</label>
        <TextInput
          value={value}
          onChange={handleValueChange}
          placeholder='vitalik.eth'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>encode</button>
        </div>
      </form>
      <div>{result !== null && <pre>{result}</pre>}</div>
    </div>
  )
}

function IPNSContentHash (props: any) {
  const [value, setValue] = useState<string>(
    localStorage.getItem('ipnsContentHashValue' || '') || ''
  )
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    localStorage.setItem('ipnsContentHashValue', value || '')
  }, [value])
  const handleValueChange = (_value: string) => {
    setValue(_value)
  }
  const encode = () => {
    try {
      setResult(null)
      if (value) {
        const base58content = base58.encode(
          Buffer.concat([Buffer.from([0, value.length]), Buffer.from(value)])
        )
        const ensContentHash = `0x${contentHash.encode(
          'ipns-ns',
          base58content
        )}`
        setResult(ensContentHash)
      }
    } catch (err) {
      alert(err.message)
    }
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    encode()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>IPNS ContentHash</label>
        <TextInput
          value={value}
          onChange={handleValueChange}
          placeholder='app.example.com'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>encode</button>
        </div>
      </form>
      <div>{result !== null && <pre>{result}</pre>}</div>
    </div>
  )
}

function IpfsCoder (props: any) {
  const [v1Value, setV1Value] = useState<string>(
    localStorage.getItem('ipfsV1Value' || '') || ''
  )
  const [v0Value, setV0Value] = useState<string>(
    localStorage.getItem('ipfsV0Value' || '') || ''
  )
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    localStorage.setItem('ipfsV1Value', v1Value || '')
  }, [v1Value])
  useEffect(() => {
    localStorage.setItem('ipfsV0Value', v0Value || '')
  }, [v0Value])
  const handleV1ValueChange = (_value: string = '') => {
    setV1Value(_value)
  }
  const handleV0ValueChange = (_value: string = '') => {
    setV0Value(_value)
  }
  const toV1 = () => {
    try {
      setResult(null)
      setResult(new CID(v0Value).toV1().toString('base16'))
    } catch (err) {
      alert(err.message)
    }
  }
  const toV0 = () => {
    try {
      setResult(null)
      setResult(new CID(v1Value).toV0().toString())
    } catch (err) {
      alert(err.message)
    }
  }
  const handleV0Submit = (event: any) => {
    event.preventDefault()
    toV0()
  }
  const handleV1Submit = (event: any) => {
    event.preventDefault()
    toV1()
  }
  return (
    <div>
      <form onSubmit={handleV1Submit}>
        <label>To V1</label>
        <TextInput
          value={v0Value}
          onChange={handleV0ValueChange}
          placeholder='QmZ4tDuvesekSs4qM5ZBKpXiZGun7S2CYtEZRB3DYXkjGx'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>convert</button>
        </div>
      </form>
      <form onSubmit={handleV0Submit}>
        <label>To V0</label>
        <TextInput
          value={v1Value}
          onChange={handleV1ValueChange}
          placeholder='f017012209f668b20cfd24cdbf9e1980fa4867d08c67d2caf8499e6df81b9bf0b1c97287d'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>convert</button>
        </div>
      </form>
      <div>{result !== null && <pre>{result}</pre>}</div>
    </div>
  )
}

// more info: https://github.com/ensdomains/ens-app/issues/849#issuecomment-777088950
// ens public resolver: 0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41
function ContentHashCoder (props: any) {
  const [shouldBase58EncodeContent, setShouldBase58EncodeContent] = useState<
    boolean
  >(false)
  const [encodeValue, setEncodeValue] = useState<string>(
    localStorage.getItem('contentHashEncodeValue' || '') || ''
  )
  const [decodeValue, setDecodeValue] = useState<string>(
    localStorage.getItem('contentHashDecodeValue' || '') || ''
  )
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    localStorage.setItem('contentHashEncodeValue', encodeValue || '')
  }, [encodeValue])
  useEffect(() => {
    localStorage.setItem('contentHashDecodeValue', decodeValue || '')
  }, [decodeValue])
  const handleEncodeValueChange = (_value: string = '') => {
    setEncodeValue(_value)
  }
  const handleDecodeValueChange = (_value: string = '') => {
    setDecodeValue(_value)
  }
  const encode = () => {
    try {
      setResult(null)
      const matched =
        encodeValue.match(
          /^(ipfs-ns|ipfs|ipns|ipns-ns|bzz|onion|onion3):\/\/(.*)/
        ) ||
        encodeValue.match(/\/(ipfs)\/(.*)/) ||
        encodeValue.match(/\/(ipns)\/(.*)/)
      if (!matched) {
        throw new Error('could not encode (missing protocol)')
      }

      const contentType = matched[1]
      const content = matched[2]
      let base58content = content

      if (shouldBase58EncodeContent) {
        base58content = base58.encode(
          Buffer.concat([
            Buffer.from([0, content.length]),
            Buffer.from(content)
          ])
        )
      }

      console.log('contentType:', contentType)
      console.log('base58Content:', base58content)

      let ensContentHash = ''
      if (shouldBase58EncodeContent) {
        ensContentHash = contentHash.encode(contentType, base58content)
      } else {
        ensContentHash = contentHash2.encode(contentType, base58content)
      }
      ensContentHash = `0x${ensContentHash}`
      setResult(ensContentHash)
    } catch (err) {
      alert(err.message)
    }
  }
  const decode = () => {
    try {
      setResult(null)
      const _value = decodeValue.replace('0x', '')
      setResult(
        `${contentHash2.getCodec(_value)}://${contentHash2.decode(_value)}`
      )
    } catch (err) {
      alert(err.message)
    }
  }
  const handleEncodeSubmit = (event: any) => {
    event.preventDefault()
    encode()
  }
  const handleDecodeSubmit = (event: any) => {
    event.preventDefault()
    decode()
  }
  const handleCheckboxChange = (event: any) => {
    setShouldBase58EncodeContent(event.target.checked)
  }
  return (
    <div>
      <form onSubmit={handleEncodeSubmit}>
        <label>
          Encode <small>(e.g. {`ipns-ns://<peer-id>`})</small>
        </label>
        <TextInput
          value={encodeValue}
          onChange={handleEncodeValueChange}
          placeholder='ipfs-ns://QmZ4tDuvesekSs4qM5ZBKpXiZGun7S2CYtEZRB3DYXkjGx'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <input
            type='checkbox'
            checked={shouldBase58EncodeContent}
            onChange={handleCheckboxChange}
          />
          base58 encode content <small>(ie. using domain)</small>
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>encode</button>
        </div>
      </form>
      <form onSubmit={handleDecodeSubmit}>
        <label>Decode</label>
        <TextInput
          value={decodeValue}
          onChange={handleDecodeValueChange}
          placeholder='0xe301017012209f668b20cfd24cdbf9e1980fa4867d08c67d2caf8499e6df81b9bf0b1c97287d'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>decode</button>
        </div>
      </form>
      <div>{result !== null && <pre>{result}</pre>}</div>
    </div>
  )
}

function ChecksumAddress (props: any) {
  const [value, setValue] = useState<string>(
    localStorage.getItem('checksumAddressValue' || '') || ''
  )
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    localStorage.setItem('checksumAddressValue', value || '')
  }, [value])
  const handleValueChange = (_value: string) => {
    setValue(_value)
  }
  const checksum = () => {
    try {
      setResult(null)
      if (!value) {
        return
      }
      setResult(utils.getAddress(value.trim()))
    } catch (err) {
      alert(err.message)
    }
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    checksum()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Checksum Address</label>
        <TextInput
          value={value}
          onChange={handleValueChange}
          placeholder='0x...'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>checksum</button>
        </div>
      </form>
      <div>{result}</div>
    </div>
  )
}

function PrivateKeyToAddress (props: any) {
  const [value, setValue] = useState<string>(
    localStorage.getItem('privateKeyToAddressValue' || '') || ''
  )
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    localStorage.setItem('privateKeyToAddressValue', value || '')
  }, [value])
  const handleValueChange = (_value: string) => {
    setValue(_value)
  }
  const update = () => {
    try {
      setResult(null)
      if (!value) {
        return
      }
      setResult(privateKeyToAddress(value.trim().replace('0x', '')))
    } catch (err) {
      alert(err.message)
    }
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    update()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Private Key to Address</label>
        <TextInput
          value={value}
          onChange={handleValueChange}
          placeholder='0x...'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>get address</button>
        </div>
      </form>
      <div>{result}</div>
    </div>
  )
}

function PrivateKeyToPublicKey (props: any) {
  const [value, setValue] = useState<string>(
    localStorage.getItem('privateKeyToPublicKeyValue' || '') || ''
  )
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    localStorage.setItem('privateKeyToPublicKeyValue', value || '')
  }, [value])
  const handleValueChange = (_value: string) => {
    setValue(_value)
  }
  const update = () => {
    try {
      setResult(null)
      if (!value) {
        return
      }
      setResult(
        privateKeyToPublicKey(value.trim().replace('0x', '')).toString('hex')
      )
    } catch (err) {
      alert(err.message)
    }
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    update()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Private Key to Public Key</label>
        <TextInput
          value={value}
          onChange={handleValueChange}
          placeholder='0x...'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>get public key</button>
        </div>
      </form>
      <div style={{ wordBreak: 'break-all' }}>{result}</div>
    </div>
  )
}

function PublicKeyToAddress (props: any) {
  const [value, setValue] = useState<string>(
    localStorage.getItem('publicKeyToAddressValue' || '') || ''
  )
  const [result, setResult] = useState<string | null>(null)
  useEffect(() => {
    localStorage.setItem('publicKeyToAddressValue', value || '')
  }, [value])
  const handleValueChange = (_value: string) => {
    setValue(_value)
  }
  const update = () => {
    try {
      setResult(null)
      if (!value) {
        return
      }
      setResult(publicKeyToAddress(value.trim().replace('0x', '')))
    } catch (err) {
      alert(err.message)
    }
  }
  const handleSubmit = (event: any) => {
    event.preventDefault()
    update()
  }
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>Public Key to Address</label>
        <TextInput
          value={value}
          onChange={handleValueChange}
          placeholder='0x...'
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type='submit'>get address</button>
        </div>
      </form>
      <div>{result}</div>
    </div>
  )
}

function App () {
  const [useWeb3, setUseWeb3] = useState<boolean>(() => {
    const cached = localStorage.getItem('useWeb3')
    if (cached) {
      return cached === 'true'
    }
    return true
  })
  const [privateKey, setPrivateKey] = useState(() => {
    return localStorage.getItem('privateKey') || ''
  })
  const [networkName, setNetworkName] = useState('')
  const [networkId, setNetworkId] = useState('')
  const [networkOption, setNetworkOption] = useState(() => {
    return localStorage.getItem('networkOption') || 'mainnet'
  })
  const [rpcProviderUrl, setRpcProviderUrl] = useState<string>(() => {
    return localStorage.getItem('rpcProviderUrl') || ''
  })
  const [rpcProvider, setRpcProvider] = useState<any>(() => {
    const net = localStorage.getItem('networkOption') || 'mainnet'
    const url = localStorage.getItem('rpcProviderUrl')
    if (url) {
      return new providers.StaticJsonRpcProvider(url.replace('{network}', net))
    }

    if (net === 'injected' && (window as any).ethereum) {
      return new providers.Web3Provider((window as any).ethereum, 'any')
    }

    return providers.getDefaultProvider(net)
  })
  const [wallet, setWallet] = useState<any>(rpcProvider)
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [contractAddress, setContractAddress] = useState(() => {
    return localStorage.getItem('contractAddress') || ''
  })
  const [newAbiName, setNewAbiName] = useState('')
  const [abiMethodFormShown, showAbiMethodForm] = useState(false)
  const [selectedAbi, setSelectedAbi] = useState(() => {
    const selected = localStorage.getItem('selectedAbi')
    return selected || 'ERC20'
  })
  const [customAbis, setCustomAbis] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('customAbis') || '') || {}
    } catch (err) {
      return {}
    }
  })
  const [customAbi, setCustomAbi] = useState(() => {
    return localStorage.getItem('customAbi') || '[]'
  })
  const [abis, setAbis] = useState<any>(() => {
    return { ...nativeAbis, ...customAbis }
  })
  const [abi, setAbi] = useState(() => {
    const selected = localStorage.getItem('selectedAbi') || Object.keys(abis)[0]
    return (abis as any)[selected]
  })
  const [abiOptions, setAbiOptions] = useState(() => {
    return Object.keys(abis)
  })
  const [selectedAbiMethod, setSelectedAbiMethod] = useState(() => {
    return localStorage.getItem('selectedAbiMethod') || 'transfer'
  })
  const [selectedAbiEvent, setSelectedAbiEvent] = useState(() => {
    return localStorage.getItem('selectedAbiEvent') || 'Transfer'
  })
  const [connectedChainId, setConnectedChainId] = useState<string | undefined>()
  const [connectedAccounts, setConnectedAccounts] = useState<
    string[] | undefined
  >()
  useEffect(() => {
    if ((window as any).ethereum) {
      ;(window as any).ethereum.on('chainChanged', (chainId: string) => {
        setConnectedChainId(chainId)
      })
      ;(window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
        setConnectedAccounts(accounts)
      })
    }
  }, [])
  useEffect(() => {
    ;(window as any).provider = rpcProvider
    setNetworkName('')
    setNetworkId('')
    rpcProvider
      .getNetwork()
      .then((network: any) => {
        setNetworkName(network?.name)
        setNetworkId(network?.chainId)
      })
      .catch(() => {})
  }, [rpcProvider, connectedChainId])
  useEffect(() => {
    ;(window as any).wallet = wallet

    const updateWalletAddress = async () => {
      setWalletAddress('')
      try {
        let signer: Signer = wallet
        if (wallet.getSigner) {
          signer = await wallet.getSigner()
        }
        if (signer?.getAddress) {
          const address = await signer.getAddress()
          setWalletAddress(address)
        }
      } catch (err) {
        console.error(err)
      }
    }
    updateWalletAddress()
  }, [wallet])
  useEffect(() => {
    try {
      if (useWeb3) {
        if ((window as any).ethereum) {
          const provider = new providers.Web3Provider(
            (window as any).ethereum,
            'any'
          )
          const signer = provider.getSigner()
          setWallet(signer)
        } else {
          alert('window.web3 not found')
        }
      } else {
        if (privateKey) {
          const priv = privateKey.replace(/^(0x)?/, '0x')
          const wal = new Wallet(priv, rpcProvider)
          setWallet(wal)
        } else {
          setWallet(null)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }, [useWeb3, privateKey, rpcProvider, connectedChainId, connectedAccounts])
  useEffect(() => {
    const selected = (abis as any)[selectedAbi]
    if (selected) {
      setAbi(JSON.stringify(selected, null, 2))
    }
  }, [selectedAbi, abis])
  useEffect(() => {
    const _abis = { ...nativeAbis, ...customAbis }
    setAbis(_abis)
    setAbiOptions(Object.keys(_abis).sort())
  }, [customAbis])
  useEffect(() => {
    localStorage.setItem('selectedAbi', selectedAbi)
  }, [selectedAbi])
  const updateUseWeb3 = (event: any) => {
    const checked = event.target.checked
    localStorage.setItem('useWeb3', checked)
    setUseWeb3(checked)
  }
  const handleNetworkOptionChange = (value: string) => {
    setNetworkOption(value)
    localStorage.setItem('networkOption', value)
    if (rpcProviderUrl) {
      let url = rpcProviderUrl.replace('{network}', value)
      const provider = new providers.JsonRpcProvider(url)
      setRpcProvider(provider)
    } else if (value === 'injected') {
      const provider = new providers.Web3Provider(
        (window as any).ethereum,
        'any'
      )
      setRpcProvider(provider)
    } else {
      setRpcProvider(providers.getDefaultProvider(value))
    }
  }
  const handlePrivateKeyChange = (value: string) => {
    value = value.trim()
    setPrivateKey(value)
    localStorage.setItem('privateKey', value)
  }
  const handleRpcProviderUrlChange = (value: string) => {
    try {
      setRpcProviderUrl(value)
      localStorage.setItem('rpcProviderUrl', value)
      value = value.replace('{network}', networkOption)
      const provider = new providers.JsonRpcProvider(
        value.replace('{network}', networkOption)
      )
      setRpcProvider(provider)
    } catch (err) {
      // noop
    }
  }
  const handleContractAddressChange = (value: string) => {
    value = value.trim()
    if (value) {
      try {
        value = utils.getAddress(value)
      } catch (err) {
        // noop
      }
    }
    setContractAddress(value)
    localStorage.setItem('contractAddress', value)
  }
  const handleSelectChange = (value: string) => {
    setSelectedAbi(value)
  }
  const handleAbiContent = (value: string) => {
    setCustomAbi(value)
    localStorage.setItem('customAbi', value)
  }
  const handleAddAbiClick = (event: any) => {
    event.preventDefault()
    showAbiMethodForm(true)
    setCustomAbi('')
  }
  const handleDeleteAbiClick = (event: any) => {
    event.preventDefault()
    try {
      const _customAbis = Object.assign({}, customAbis)
      delete _customAbis[selectedAbi]
      localStorage.setItem('customAbis', JSON.stringify(_customAbis))
      setCustomAbis(_customAbis)
      setSelectedAbi(Object.keys(nativeAbis)[0])
    } catch (err) {
      alert(err)
    }
  }
  const handleSaveAbiClick = (event: any) => {
    event.preventDefault()
    try {
      if (!newAbiName) {
        throw new Error('ABI name is required')
      }
      if (!customAbi) {
        throw new Error('ABI content is required')
      }
      const name = newAbiName.trim()
      const newAbi = {
        [name]: JSON.parse(customAbi.trim())
      }
      const _customAbis = { ...customAbis, ...newAbi }
      localStorage.setItem('customAbis', JSON.stringify(_customAbis))
      setCustomAbis(_customAbis)
      showAbiMethodForm(false)
      setCustomAbi('')
      setNewAbiName('')
      setSelectedAbi(name)
    } catch (err) {
      alert(err)
    }
  }
  const handleCancelAbiClick = (event: any) => {
    event.preventDefault()
    showAbiMethodForm(false)
    setCustomAbi('')
    setNewAbiName('')
  }
  const handleNewAbiNameChange = (value: string) => {
    setNewAbiName(value)
  }

  const renderMethodSelect = () => {
    try {
      const parsed = JSON.parse(abi)
      const options = parsed
        .map((obj: any) => {
          return obj.type === 'function' ? obj.name : null
        })
        .filter((x: any) => x)
      const handleChange = (value: string) => {
        setSelectedAbiMethod(value)
        localStorage.setItem('selectedAbiMethod', value)
      }
      return (
        <Select
          onChange={handleChange}
          selected={selectedAbiMethod}
          options={options}
        />
      )
    } catch (err) {}
  }
  const renderEventsSelect = () => {
    try {
      const parsed = JSON.parse(abi)
      const options = parsed
        .map((obj: any) => {
          return obj.type === 'event' ? obj.name : null
        })
        .filter((x: any) => x)
      const handleChange = (value: string) => {
        setSelectedAbiEvent(value)
        localStorage.setItem('selectedAbiEvent', value)
      }
      if (!options.length) {
        return null
      }
      return (
        <Select
          onChange={handleChange}
          selected={selectedAbiEvent}
          options={options}
        />
      )
    } catch (err) {}
  }
  const renderMethodForm = () => {
    try {
      const parsed = JSON.parse(abi)
      const filtered = parsed.filter((x: any) => x.name === selectedAbiMethod)
      if (!filtered.length) return null
      const obj = filtered[0]
      return (
        <AbiMethodForm
          key={obj.name}
          contractAddress={contractAddress}
          wallet={wallet}
          abi={obj}
          network={networkName}
        />
      )
    } catch (err) {
      // noop
    }
  }
  const renderEventForm = () => {
    try {
      const parsed = JSON.parse(abi)
      const filtered = parsed.filter((x: any) => x.name === selectedAbiEvent)
      if (!filtered.length) return null
      const obj = filtered[0]
      return <AbiEventForm key={obj.name} abi={obj} />
    } catch (err) {
      // noop
    }
  }

  const handleConnect = async (event: any) => {
    event.preventDefault()
    try {
      const windowWeb3 = (window as any).ethereum
      if (windowWeb3 && windowWeb3.enable) {
        await windowWeb3.enable()
      }
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <main>
      <header>
        <h1>Ethereum ABI caller tool</h1>
      </header>
      <Fieldset legend='Network'>
        <section>
          <Select
            onChange={handleNetworkOptionChange}
            selected={networkOption}
            options={networkOptions}
          />
          <div>network: {networkName}</div>
          <div>chain ID: {networkId}</div>
        </section>
        <section>
          <label>
            RPC provider url{' '}
            <small>
              note: you can use "<code>{`{network}`}</code>" to replace network
              name
            </small>
          </label>
          <TextInput
            value={rpcProviderUrl}
            onChange={handleRpcProviderUrlChange}
          />
        </section>
      </Fieldset>
      <Fieldset legend='Signer'>
        <div>
          <input type='checkbox' checked={useWeb3} onChange={updateUseWeb3} />
          use web3
        </div>
        <section>
          <label>Private key</label>
          <TextInput
            disabled={useWeb3}
            value={privateKey}
            onChange={handlePrivateKeyChange}
          />
        </section>
        {!!walletAddress && (
          <section>
            <label>Address</label>
            <div>{walletAddress}</div>
          </section>
        )}
        <section>
          <button
            onClick={handleConnect}
            disabled={!useWeb3 || !!walletAddress}
          >
            Connect Wallet
          </button>
        </section>
      </Fieldset>
      <Fieldset legend='Contract'>
        <section>
          <label>Contract address</label>
          <TextInput
            value={contractAddress}
            onChange={handleContractAddressChange}
            placeholder='0x'
          />
        </section>
      </Fieldset>
      <Fieldset legend='ABI'>
        <section>
          <div>
            {abiMethodFormShown ? (
              <div style={{ display: 'flex' }}>
                <TextInput
                  value={newAbiName}
                  onChange={handleNewAbiNameChange}
                  placeholder={'ABI name'}
                />
                <button onClick={handleSaveAbiClick}>Save</button>
                <button onClick={handleCancelAbiClick}>Cancel</button>
              </div>
            ) : (
              <div style={{ marginBottom: '1rem' }}>
                <Select
                  onChange={handleSelectChange}
                  selected={selectedAbi}
                  options={abiOptions}
                />
                <button onClick={handleAddAbiClick}>Add</button>
                {!(nativeAbis as any)[selectedAbi] ? (
                  <button onClick={handleDeleteAbiClick}>Delete</button>
                ) : null}
              </div>
            )}
          </div>
          {abiMethodFormShown && (
            <TextInput
              value={customAbi}
              onChange={handleAbiContent}
              variant='textarea'
              placeholder='[]'
            />
          )}
          {!abiMethodFormShown && (
            <div>
              <TextInput readOnly={true} value={abi} variant='textarea' />
            </div>
          )}
        </section>
      </Fieldset>
      <Fieldset legend='Method'>
        {!abiMethodFormShown && (
          <div style={{ marginBottom: '1rem' }}>{renderMethodSelect()}</div>
        )}
        {!abiMethodFormShown ? <section>{renderMethodForm()}</section> : null}
      </Fieldset>
      <Fieldset legend='Event'>
        {!abiMethodFormShown && (
          <div style={{ marginBottom: '1rem' }}>{renderEventsSelect()}</div>
        )}
        {!abiMethodFormShown ? <section>{renderEventForm()}</section> : null}
      </Fieldset>
      <Fieldset legend='Data decoder'>
        <section>
          <DataDecoder abi={abi} abiName={selectedAbi} />
        </section>
      </Fieldset>
      <Fieldset legend='Send ETH'>
        <section>
          <SendEth wallet={wallet} />
        </section>
      </Fieldset>
      <Fieldset legend='Unit converter'>
        <section>
          <UnitConverter />
        </section>
      </Fieldset>
      <Fieldset legend='Custom transaction'>
        <section>
          <CustomTx wallet={wallet} network={networkName} />
        </section>
      </Fieldset>
      <Fieldset legend='Get fee data'>
        <section>
          <GetFeeData provider={rpcProvider} />
        </section>
      </Fieldset>
      <Fieldset legend='Transaction Receipt'>
        <section>
          <TxReceipt provider={rpcProvider} />
        </section>
      </Fieldset>
      <Fieldset legend='Block'>
        <section>
          <GetBlock provider={rpcProvider} />
        </section>
      </Fieldset>
      <Fieldset legend='Get code'>
        <section>
          <GetCode provider={rpcProvider} />
        </section>
      </Fieldset>
      <Fieldset legend='Get nonce'>
        <section>
          <GetNonce provider={rpcProvider} />
        </section>
      </Fieldset>
      <Fieldset legend='ENS avatar'>
        <section>
          <EnsAvatar provider={rpcProvider} />
        </section>
      </Fieldset>
      <Fieldset legend='Hex coder'>
        <section>
          <HexCoder />
        </section>
      </Fieldset>
      <Fieldset legend='Base58 coder'>
        <section>
          <Base58Coder />
        </section>
      </Fieldset>
      <Fieldset legend='ENS coder'>
        <section>
          <EnsCoder />
        </section>
      </Fieldset>
      <Fieldset legend='IPFS coder'>
        <section>
          <IpfsCoder />
        </section>
      </Fieldset>
      <Fieldset legend='ContentHash coder'>
        <section>
          <ContentHashCoder />
        </section>
      </Fieldset>
      <Fieldset legend='IPNS ContentHash'>
        <section>
          <IPNSContentHash />
        </section>
      </Fieldset>
      <Fieldset legend='Checksum Address'>
        <section>
          <ChecksumAddress />
        </section>
      </Fieldset>
      <Fieldset legend='Private Key to Address'>
        <section>
          <PrivateKeyToAddress />
        </section>
      </Fieldset>
      <Fieldset legend='Private Key to Public Key'>
        <section>
          <PrivateKeyToPublicKey />
        </section>
      </Fieldset>
      <Fieldset legend='Public Key to Address'>
        <section>
          <PublicKeyToAddress />
        </section>
      </Fieldset>
      <Fieldset legend='Clear'>
        <section>
          <ClearLocalStorage />
        </section>
      </Fieldset>
      <footer style={{ margin: '1rem 0' }}>
        © 2020{' '}
        <a
          href='https://miguelmota.com'
          target='_blank'
          rel='noopener noreferrer'
        >
          Miguel Mota
        </a>
      </footer>
    </main>
  )
}

export default App
