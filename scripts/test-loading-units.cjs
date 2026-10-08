/**
 * Pure-Node loading-control regression tests. No browser, subprocess, network, or
 * database is required. The small hook driver below exercises the real handlers
 * and committed effects; it does not simulate browser layout or React scheduling.
 * Run the companion test-loading-controls.cjs for those browser integration checks.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '..');
let driver;
const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
const successes = [], errors = [];
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const location = { href: 'https://joro.test/original', origin: 'https://joro.test', pathname: '/original', search: '' };
const listeners = new Map();
let fetchMock = () => { throw new Error('Unexpected network request'); };
const windowMock = {
  location,
  addEventListener(name, callback) { listeners.set(name, callback); },
  removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
};

const react = {
  ...React,
  useRef(initial) { return driver.slot(() => ({ current: initial })); },
  useState(initial) {
    const owner = driver;
    const cell = owner.slot(() => ({ value: typeof initial === 'function' ? initial() : initial }));
    return [cell.value, value => {
      const next = typeof value === 'function' ? value(cell.value) : value;
      if (!Object.is(cell.value, next)) { cell.value = next; owner.dirty = true; }
    }];
  },
  useContext(context) { return context._currentValue; },
  useMemo(factory, deps) {
    const cell = driver.slot(() => ({}));
    if (!same(cell.deps, deps)) { cell.value = factory(); cell.deps = deps; }
    return cell.value;
  },
  useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
  useEffect(callback, deps) { driver.effect(callback, deps); },
  useLayoutEffect(callback, deps) { driver.effect(callback, deps); },
  useTransition() {
    const owner = driver;
    return [owner.transitionPending, callback => { owner.transitionPending = true; owner.dirty = true; callback(); }];
  },
  useSyncExternalStore(subscribe, snapshot) {
    const owner = driver;
    react.useEffect(() => subscribe(() => { owner.dirty = true; }), [subscribe]);
    return snapshot();
  },
};

class HookDriver {
  constructor(render, props = {}, node = null) {
    this.renderFunction = render; this.props = props; this.node = node;
    this.slots = []; this.cursor = 0; this.effects = []; this.transitionPending = false;
  }
  slot(create) { const i = this.cursor++; if (!(i in this.slots)) this.slots[i] = create(); return this.slots[i]; }
  effect(callback, deps) {
    const cell = this.slot(() => ({}));
    if (!same(cell.deps, deps)) {
      cell.deps = deps;
      this.effects.push(() => { cell.cleanup?.(); cell.cleanup = callback(); });
    }
  }
  render() {
    let iterations = 0;
    do {
      assert.ok(iterations++ < 20, 'render/effect loop settled');
      this.dirty = false; this.cursor = 0; driver = this;
      this.output = this.renderFunction(this.props);
      if (this.node && this.output?.ref) this.output.ref(this.node);
      this.effects.splice(0).forEach(effect => effect());
    } while (this.dirty);
    return this.output;
  }
  finishTransition() { this.transitionPending = false; return this.render(); }
  unmount() { this.slots.forEach(cell => cell.cleanup?.()); }
}

const cache = new Map();
function load(file) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} }; cache.set(absolute, module);
  const contents = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  function localRequire(id) {
    if (id === 'react') return react;
    if (id === 'react-hot-toast') return { success: text => successes.push(text), error: text => errors.push(text) };
    if (id === 'next/navigation') return { useRouter: () => router };
    if (id === '@/context/CustomerAuthContext') return { useCustomerAuth: () => ({ isCustomer: true, authLoading: false }) };
    if (id === 'next/link') return React.forwardRef(function Link(props, ref) { return React.createElement('a', { ...props, ref }); });
    if (id.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
    if (!id.startsWith('.') && !id.startsWith('@/')) return require(id);
    const base = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(absolute), id);
    const resolved = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    assert.ok(resolved, `module ${id} resolves`);
    return load(resolved);
  }
  const context = vm.createContext({ module, exports: module.exports, require: localRequire, window: windowMock,
    console, URL, URLSearchParams, FormData, Promise, Error, Symbol, Set, Map, fetch: (...args) => fetchMock(...args),
    ResizeObserver: class { observe() {} disconnect() {} },
  });
  new vm.Script(contents, { filename: absolute }).runInContext(context);
  return module.exports;
}

function gate() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const node = () => ({ getBoundingClientRect: () => ({ width: 142, height: 44 }) });
const click = (target, extra = {}) => ({ currentTarget: target, button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra });
function find(element, type) {
  if (element?.type === type) return element;
  for (const child of React.Children.toArray(element?.props?.children)) { const result = find(child, type); if (result) return result; }
}
const tick = () => new Promise(resolve => queueMicrotask(resolve));

async function main() {
  const { LoadingButton } = load('components/ui/LoadingButton.tsx');
  const { LoadingForm } = load('components/ui/LoadingForm.tsx');
  const { LoadingLink } = load('components/ui/LoadingLink.tsx');
  const { useLoadingRouter } = load('hooks/useLoadingRouter.ts');
  const pages = load('hooks/usePageLoading.ts');

  let request = gate(), requests = 0;
  const button = new HookDriver(props => LoadingButton.render(props, null), {
    children: 'Save changes', loadingLabel: 'Saving…', successMessage: 'Saved',
    onClick: () => { requests++; return request.promise; },
  }, node());
  button.render();
  const staleClick = button.output.props.onClick;
  const operation = staleClick(click(button.node));
  await staleClick(click(button.node));
  assert.equal(requests, 1, 'same-tick duplicate is prevented before rerender');
  button.render();
  assert.equal(button.output.props.disabled, true);
  assert.equal(button.output.props['aria-busy'], true);
  assert.equal(button.output.props['aria-label'], 'Saving…');
  assert.equal(button.output.props.style.width, 142);
  assert.equal(button.output.props.style.height, 44);
  assert.equal(button.output.props.children.at(-1).props.role, 'status');
  assert.equal(button.output.props.children.at(-1).props.children, 'Saving…');

  const unrelated = new HookDriver(props => LoadingButton.render(props, null), { children: 'Toggle', onClick: () => 1 }, node());
  unrelated.render();
  assert.equal(unrelated.output.props.disabled, false);
  await unrelated.output.props.onClick(click(unrelated.node));
  unrelated.render();
  assert.equal(unrelated.output.props['data-loading'], undefined, 'instant action never enters loading');
  request.resolve(); await operation; button.render();
  assert.equal(button.output.props.disabled, false); assert.equal(successes.at(-1), 'Saved');
  assert.equal(button.output.props.style.width, undefined, 'size lock is released after completion');

  request = gate();
  const failed = button.output.props.onClick(click(button.node)); button.render();
  request.reject(new Error('Save rejected')); await failed; button.render();
  assert.equal(errors.at(-1), 'Save rejected'); assert.equal(button.output.props.disabled, false);
  request = gate();
  const retry = button.output.props.onClick(click(button.node)); button.render();
  request.resolve(); await retry; button.render(); assert.equal(requests, 3);
  button.props.onClick = () => { throw new Error('Immediate failure'); };
  button.render(); await button.output.props.onClick(click(button.node)); button.render();
  assert.equal(errors.at(-1), 'Immediate failure'); assert.equal(button.output.props.disabled, false);
  console.log('PASS button handlers: duplicate guard, independent actions, success, rejection, retry, synchronous failure, accessibility, dimension-lock values');

  const formNode = { method: 'post', querySelector: () => button.node };
  let submission = gate(), submissions = 0;
  const form = new HookDriver(props => LoadingForm.render(props, null), {
    onSubmit: event => { event.preventDefault(); submissions++; return submission.promise; },
  });
  form.render();
  const submitEvent = () => ({ currentTarget: formNode, nativeEvent: { submitter: null }, preventDefault() {} });
  const submit = find(form.output, 'form').props.onSubmit;
  const firstSubmit = submit(submitEvent()); await submit(submitEvent()); form.render();
  assert.equal(submissions, 1);
  assert.equal(form.output.props.value.pending, true);
  assert.equal(form.output.props.value.submitter, button.node, 'Enter submission selects a submit button');
  assert.equal(find(form.output, 'form').props['aria-busy'], true);
  submission.reject(new Error('Please correct the form')); await firstSubmit; form.render();
  assert.equal(errors.at(-1), 'Please correct the form'); assert.equal(form.output.props.value.pending, false);
  submission = gate();
  const secondSubmit = find(form.output, 'form').props.onSubmit(submitEvent()); form.render();
  submission.resolve(); await secondSubmit; form.render(); assert.equal(submissions, 2);
  assert.equal(form.output.props.value.pending, false);
  console.log('PASS form handlers: Enter submitter fallback, duplicate guard, server rejection, successful retry');

  const route = new HookDriver(() => useLoadingRouter()); route.render();
  let calls = 0; router.push = () => { calls++; };
  let settled = false;
  const navigation = route.output.push('/destination').then(() => { settled = true; }); route.render();
  await tick(); assert.equal(settled, false, 'navigation waits for route transition');
  const destination = new HookDriver(({ loading }) => pages.usePageLoading(loading), { loading: true }); destination.render();
  route.finishTransition(); await tick(); assert.equal(settled, false, 'navigation waits for committed destination fetching');
  destination.props.loading = false; destination.render(); route.render(); await navigation;
  assert.equal(settled, true); assert.equal(calls, 1);
  assert.equal(pages.hasPendingPages(), false);
  router.push = () => { throw new Error('Navigation rejected'); };
  await assert.rejects(route.output.push('/failed'), /Navigation rejected/);
  route.finishTransition();
  router.push = () => { calls++; };
  const navRetry = route.output.push('/retry'); route.finishTransition(); await navRetry;
  const unmountedNavigation = route.output.push('/leaving'); route.unmount(); await unmountedNavigation;
  destination.props.loading = true; destination.render(); assert.equal(pages.hasPendingPages(), true);
  destination.unmount(); assert.equal(pages.hasPendingPages(), false, 'page cleanup releases loading registration');
  console.log('PASS navigation lifecycle: transition and destination-data gates, rejection, retry, unmount cleanup');

  for (const props of [{ href: '#section' }, { href: '/original' }, { href: 'https://elsewhere.test/' }, { href: '/destination', target: '_blank' }]) {
    const link = new HookDriver(p => LoadingLink.render(p, null), props); link.render();
    const event = click(node()); await link.output.props.onClick(event); link.render();
    assert.equal(event.defaultPrevented, false); assert.equal(link.output.props['data-loading'], undefined);
    link.unmount();
  }
  let navigationCompletions = 0;
  const link = new HookDriver(p => LoadingLink.render(p, null), { href: '/destination', children: 'Open destination', onNavigateComplete: () => { navigationCompletions++; } }); link.render();
  const modified = click(node(), { ctrlKey: true }); await link.output.props.onClick(modified); link.render();
  assert.equal(modified.defaultPrevented, false);
  const event = click(node()); const linkNavigation = link.output.props.onClick(event); link.render();
  assert.equal(event.defaultPrevented, true); assert.equal(link.output.props['aria-disabled'], true);
  assert.equal(link.output.props.style.width, 142); assert.equal(link.output.props['data-loading'], 'true');
  assert.equal(navigationCompletions, 0, 'navigation menus remain open while their destination is pending');
  await link.output.props.onClick(click(node()));
  link.finishTransition(); await linkNavigation; link.render();
  assert.equal(link.output.props['aria-disabled'], undefined);
  assert.equal(navigationCompletions, 1, 'navigation completion closes the menu after destination readiness');
  link.unmount(); form.unmount(); button.unmount(); unrelated.unmount();
  console.log('PASS link handlers: native hash/external/new-tab/modified semantics, duplicate lock, navigation completion');

  const { StoreFollowButton } = load('components/user/StoreFollowButton.tsx');
  let http = gate(), httpCalls = 0;
  fetchMock = () => { httpCalls++; return http.promise; };
  const customer = new HookDriver(props => StoreFollowButton(props), { vendorId: 'example', initialFollowers: 3 });
  customer.render();
  const customerButton = new HookDriver(props => LoadingButton.render(props, null), customer.output.props, node());
  customerButton.render();
  const followFailure = customerButton.output.props.onClick(click(customerButton.node));
  customer.render(); customerButton.props = customer.output.props; customerButton.render();
  assert.equal(customerButton.output.props.disabled, true);
  http.resolve({ ok: false, json: async () => ({ error: 'Follow rejected' }) });
  await followFailure; customer.render(); customerButton.props = customer.output.props; customerButton.render();
  assert.equal(errors.at(-1), 'Follow rejected'); assert.equal(customerButton.output.props.disabled, false);
  http = gate();
  const followSuccess = customerButton.output.props.onClick(click(customerButton.node));
  http.resolve({ ok: true, json: async () => ({ following: true, followers: 4 }) });
  await followSuccess; customer.render(); customerButton.props = customer.output.props; customerButton.render();
  assert.equal(customerButton.output.props['aria-pressed'], true); assert.equal(successes.at(-1), 'Store followed');
  assert.equal(httpCalls, 2); customerButton.unmount(); customer.unmount();

  const { UpdateStatusBtn } = load('components/orders/UpdateStatusBtn.tsx');
  const reload = gate(); http = gate();
  const vendor = new HookDriver(props => UpdateStatusBtn(props), { currentStatus: 'pending', statusUrl: '/test/order', onSuccess: () => reload.promise });
  vendor.render(); find(vendor.output, LoadingButton).props.onClick(); vendor.render();
  const confirmElement = vendor.output.props.children[1].props.children.props.children.at(-1).props.children[1];
  const confirm = new HookDriver(props => LoadingButton.render(props, null), confirmElement.props, node()); confirm.render();
  const orderFailure = confirm.output.props.onClick(click(confirm.node)); confirm.render();
  http.resolve({ ok: false, json: async () => ({ error: 'Order update rejected' }) });
  await orderFailure; confirm.render(); vendor.render();
  assert.equal(errors.at(-1), 'Order update rejected'); assert.equal(confirm.output.props.disabled, false);
  http = gate();
  let updated = false;
  const orderSuccess = confirm.output.props.onClick(click(confirm.node)).then(() => { updated = true; }); confirm.render();
  http.resolve({ ok: true, json: async () => ({}) });
  await tick(); await tick(); assert.equal(updated, false, 'vendor update awaits the actual reload');
  assert.equal(confirm.output.props.disabled, true);
  reload.resolve(); await orderSuccess; confirm.render(); vendor.render();
  assert.equal(successes.at(-1), 'Order status updated'); assert.equal(vendor.output.props.children[1], null);
  confirm.unmount(); vendor.unmount();

  const { CancelModal } = load('components/orders/CancelModal.tsx');
  let cancellation = gate(), closed = 0;
  const cancel = new HookDriver(props => CancelModal(props), { open: true, onConfirm: () => cancellation.promise, onClose: () => { closed++; } });
  cancel.render(); find(cancel.output, 'textarea').props.onChange({ target: { value: 'Incorrect item' } }); cancel.render();
  const cancelButton = new HookDriver(props => LoadingButton.render(props, null), find(cancel.output, LoadingButton).props, node()); cancelButton.render();
  const cancellationFailure = cancelButton.output.props.onClick(click(cancelButton.node)); cancelButton.render();
  cancellation.reject(new Error('Cancellation rejected')); await cancellationFailure; cancelButton.render(); cancel.render();
  assert.equal(errors.at(-1), 'Cancellation rejected'); assert.equal(closed, 0);
  assert.equal(find(cancel.output, 'textarea').props.value, 'Incorrect item', 'failed cancellation preserves the reason for retry');
  cancellation = gate();
  const cancellationSuccess = cancelButton.output.props.onClick(click(cancelButton.node)); cancelButton.render();
  cancellation.resolve(); await cancellationSuccess; cancelButton.render(); cancel.render();
  assert.equal(closed, 1); assert.equal(find(cancel.output, 'textarea').props.value, '');
  cancelButton.unmount(); cancel.unmount();

  const AdminWants = load('app/admin/wants/page.tsx').default;
  const want = { id: '1', title: 'A bicycle', description: 'Example', category: 'Other', city: 'Lahore', budgetMax: null, status: 'PENDING_MODERATION', moderationReason: null, createdAt: '2026-10-08', customer: { name: 'Customer', email: 'customer@example.test' }, _count: { offers: 0, interests: 0 } };
  http = gate();
  fetchMock = (_url, options) => options?.method === 'PATCH' ? http.promise : Promise.resolve({ ok: true, json: async () => ({ wants: [want] }) });
  const admin = new HookDriver(() => AdminWants()); admin.render();
  for (let i = 0; i < 10 && !find(admin.output, LoadingButton); i++) { await tick(); admin.render(); }
  const approve = new HookDriver(props => LoadingButton.render(props, null), find(admin.output, LoadingButton).props, node()); approve.render();
  const approvalFailure = approve.output.props.onClick(click(approve.node)); approve.render();
  http.resolve({ ok: false, json: async () => ({ error: 'Moderation denied' }) });
  await approvalFailure; approve.render(); assert.equal(errors.at(-1), 'Moderation denied'); assert.equal(approve.output.props.disabled, false);
  http = gate();
  const approvalSuccess = approve.output.props.onClick(click(approve.node)); approve.render();
  http.resolve({ ok: true, json: async () => ({}) });
  await approvalSuccess; approve.render(); assert.equal(approve.output.props.disabled, false); assert.equal(successes.at(-1), 'Want updated');
  approve.unmount(); admin.unmount();
  http = gate(); fetchMock = () => http.promise;
  const failedAdmin = new HookDriver(() => AdminWants()); failedAdmin.render();
  http.resolve({ ok: false, json: async () => ({ error: 'Wants unavailable' }) });
  for (let i = 0; i < 10 && !find(failedAdmin.output, LoadingButton); i++) { await tick(); failedAdmin.render(); }
  assert.equal(find(failedAdmin.output, LoadingButton).props.children, 'Try again');
  http = gate();
  const retryLoad = find(failedAdmin.output, LoadingButton).props.onClick(); failedAdmin.render();
  assert.equal(find(failedAdmin.output, LoadingButton)?.props.children, 'Try again', 'retry control remains mounted while the request is pending');
  http.resolve({ ok: true, json: async () => ({ wants: [want] }) });
  await retryLoad; failedAdmin.render();
  assert.equal(find(failedAdmin.output, LoadingButton).props.children, 'Approve');
  failedAdmin.unmount();
  console.log('PASS real customer/vendor/admin handlers with mocked HTTP: failed requests, successful retries, feedback and awaited reload');

  const { actionErrorMessage } = load('lib/action-feedback.ts');
  assert.equal(actionErrorMessage(new Error('Failed to fetch')), 'Something went wrong. Please try again.');
  assert.equal(actionErrorMessage(new Error('Insufficient stock')), 'Insufficient stock');
  assert.equal(actionErrorMessage(null, 'Try again'), 'Try again');
  const { navigateDocument } = load('lib/navigate-document.ts');
  let assigned; location.assign = href => { assigned = href; };
  let documentReady = false; const documentNav = navigateDocument('/login').then(() => { documentReady = true; });
  await tick(); assert.equal(documentReady, false); assert.equal(assigned, '/login');
  listeners.get('pagehide')(); await documentNav;
  location.replace = () => { throw new Error('Navigation unavailable'); };
  await assert.rejects(navigateDocument('/login', true), /Navigation unavailable/);
  assert.equal(listeners.has('pagehide'), false);
  console.log('PASS feedback and document navigation: readable errors, pending until pagehide, thrown failure cleanup');
  console.log('All pure-Node checks passed. Browser rendering, actual dimensions and React/Next scheduling require the browser suite.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
