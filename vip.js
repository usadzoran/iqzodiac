(async () => {
  const adapter = window.IQZodiacData.adapter;
  const access = await adapter.getAccountAccess();
  const title = document.querySelector('#vip-title'); const copy = document.querySelector('#vip-copy'); const action = document.querySelector('#vip-action'); const status = document.querySelector('#vip-status');
  if (access.role === 'vip') { title.textContent = 'Welcome inside the VIP orbit.'; copy.textContent = 'Your VIP role is active. This gate is ready to host private sections and future member benefits without changing the regular account flow.'; action.textContent = 'VIP access active'; action.disabled = true; status.textContent = 'Role: VIP · priority matching enabled'; }
  action.addEventListener('click', async () => { const result = await adapter.requestVipCheckout(); status.textContent = result.message; });
})();
