export const SCALER_FIXTURE = [
  '<p id="a" style="font-size:20px;line-height:1.2">Hello <span id="b" style="font-size:10px;line-height:1.2">inner</span></p>',
  '<div class="skip"><p id="c" style="font-size:20px;line-height:1.2">excluded</p></div>',
  '<div id="ka11y-root"><p id="d" style="font-size:20px;line-height:1.2">widget</p></div>',
  '<p id="e" style="font-size:30px;line-height:3">important</p>',
].join('');

export const mountScalerFixture = (): void => {
  document.body.innerHTML = SCALER_FIXTURE;
  const important = document.getElementById('e') as HTMLElement;
  important.style.setProperty('font-size', '30px', 'important');
};
