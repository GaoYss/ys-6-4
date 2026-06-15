import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, PackagePlus, XCircle, Info, X, Check } from 'lucide-react'
import { api } from '../api/client.js'
import { StatusBadge } from '../components/StatusBadge.jsx'

const ACTION_ICON_MAP = {
  ordered: PackagePlus,
  received: CheckCircle2,
  cancelled: XCircle,
}

const ACTION_VARIANT = {
  cancelled: 'danger',
}

const AUTO_DISMISS_MS = 3500

function buildTipText(order) {
  const label = order.current_status_label || order.status
  const actions = order.available_actions || []
  if (actions.length === 0) {
    return `当前状态：${label}，无可执行操作`
  }
  return `当前状态：${label}，可执行「${actions.map((a) => a.label).join('」「')}」`
}

function buildSuccessMessage(targetStatus) {
  if (targetStatus === 'ordered') return '采购单已提交'
  if (targetStatus === 'received') return '入库收货成功'
  if (targetStatus === 'cancelled') return '订单已取消'
  return '操作成功'
}

export function Supply({ ingredients, suppliers, purchaseOrders, refresh }) {
  const [errorMessage, setErrorMessage] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const errorTimerRef = useRef(null)
  const successTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  const dismissError = () => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
    setErrorMessage(null)
  }

  const dismissSuccess = () => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current)
      successTimerRef.current = null
    }
    setSuccessMessage(null)
  }

  const showError = (msg) => {
    dismissSuccess()
    setErrorMessage(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(dismissError, AUTO_DISMISS_MS)
  }

  const showSuccess = (msg) => {
    dismissError()
    setSuccessMessage(msg)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(dismissSuccess, AUTO_DISMISS_MS)
  }

  const [form, setForm] = useState({
    supplier_id: '',
    ingredient_id: '',
    qty: '',
    unit_price: '',
    expected_arrival: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    remark: '',
  })

  const selectedIngredient = useMemo(
    () => ingredients.find((item) => item.id === form.ingredient_id),
    [ingredients, form.ingredient_id],
  )

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    dismissError()
    dismissSuccess()
    try {
      await api.createPurchaseOrder({
        supplier_id: form.supplier_id,
        expected_arrival: form.expected_arrival,
        remark: form.remark,
        items: [{
          ingredient_id: form.ingredient_id,
          qty: Number(form.qty),
          unit_price: Number(form.unit_price),
        }],
      })
      setForm((current) => ({ ...current, ingredient_id: '', qty: '', unit_price: '', remark: '' }))
      showSuccess('采购单创建成功')
      refresh()
    } catch (err) {
      showError(err.message || '创建采购单失败')
    }
  }

  const updateStatus = async (order, targetStatus) => {
    dismissError()
    dismissSuccess()
    try {
      await api.updatePurchaseStatus(order.id, targetStatus)
      showSuccess(buildSuccessMessage(targetStatus))
      refresh()
    } catch (err) {
      showError(err.message || '操作失败')
    }
  }

  return (
    <div className="page-grid">
      {successMessage && (
        <div className="notice success">
          <Check size={16} />
          <span>{successMessage}</span>
          <button
            type="button"
            className="icon-only"
            onClick={dismissSuccess}
            aria-label="关闭提示"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="notice error">
          <span>{errorMessage}</span>
          <button
            type="button"
            className="icon-only"
            onClick={dismissError}
            aria-label="关闭提示"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <section className="panel">
        <div className="section-title">
          <h2>原料库存</h2>
          <span>{ingredients.length} 项</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>原料</th>
                <th>分类</th>
                <th>库存</th>
                <th>安全库存</th>
                <th>均价</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((item) => (
                <tr key={item.id} className={item.stock_qty <= item.safety_stock ? 'warning-row' : ''}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.category}</td>
                  <td>{item.stock_qty}{item.unit}</td>
                  <td>{item.safety_stock}{item.unit}</td>
                  <td>¥{item.avg_price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="two-column compact">
        <section className="panel">
          <div className="section-title">
            <h2>采购单</h2>
            <span>{purchaseOrders.length} 单</span>
          </div>
          <div className="list">
            {purchaseOrders.map((order) => (
              <div className="order-row" key={order.id}>
                <div>
                  <strong>{order.id}</strong>
                  <span>{suppliers.find((item) => item.id === order.supplier_id)?.name} · 到货 {order.expected_arrival}</span>
                  <small>{order.remark || '无备注'}</small>
                </div>
                <div className="order-side">
                  <b>¥{order.total_amount}</b>
                  <StatusBadge value={order.status} label={order.current_status_label} />
                  <div className="order-actions">
                    {(order.available_actions || []).map((action) => {
                      const Icon = ACTION_ICON_MAP[action.status] || PackagePlus
                      const variant = ACTION_VARIANT[action.status]
                      return (
                        <button
                          key={action.status}
                          type="button"
                          className={variant === 'danger' ? 'danger-btn' : ''}
                          onClick={() => updateStatus(order, action.status)}
                        >
                          <Icon size={15} />
                          {action.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="order-tip">
                    <Info size={12} />
                    <span>{buildTipText(order)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel side-panel">
          <div className="section-title">
            <h2>新建采购</h2>
            <PackagePlus size={18} />
          </div>
          <form className="form" onSubmit={submit}>
            <label>
              供应商
              <select value={form.supplier_id} onChange={(event) => updateField('supplier_id', event.target.value)} required>
                <option value="">选择供应商</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </label>
            <label>
              原料
              <select value={form.ingredient_id} onChange={(event) => updateField('ingredient_id', event.target.value)} required>
                <option value="">选择原料</option>
                {ingredients.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                数量{selectedIngredient ? `(${selectedIngredient.unit})` : ''}
                <input type="number" min="0" step="0.1" value={form.qty} onChange={(event) => updateField('qty', event.target.value)} required />
              </label>
              <label>
                单价
                <input type="number" min="0" step="0.1" value={form.unit_price} onChange={(event) => updateField('unit_price', event.target.value)} required />
              </label>
            </div>
            <label>
              预计到货
              <input type="date" value={form.expected_arrival} onChange={(event) => updateField('expected_arrival', event.target.value)} required />
            </label>
            <label>
              备注
              <textarea rows="3" value={form.remark} onChange={(event) => updateField('remark', event.target.value)} />
            </label>
            <button className="primary" type="submit">
              <PackagePlus size={16} />
              <span>提交采购</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

