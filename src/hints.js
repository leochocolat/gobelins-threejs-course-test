// Press the matching key brick while the real key is held down
const keys = document.querySelectorAll('.key[data-code]');

function setPressed(code, isPressed) {
    keys.forEach((key) => {
        if (key.dataset.code === code) key.classList.toggle('is-pressed', isPressed);
    });
}

window.addEventListener('keydown', (event) => setPressed(event.code, true));
window.addEventListener('keyup', (event) => setPressed(event.code, false));
window.addEventListener('blur', () => keys.forEach((key) => key.classList.remove('is-pressed')));
