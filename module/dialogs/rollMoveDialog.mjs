class RollMoveDialog extends Dialog {
	constructor(dialogData = {}, options = {}) {
		super(dialogData, options);
		this.options.classes = ["my-custom-class-name"];
	}

	/**
	 * A custom dialog factory for our use case.
	 * @param {object} options
	 * @param {string} options.name - The name of whoever we are greeting
	 * @returns {Promise}
	 */
	static async create(item) {
		return new Promise((resolve) => {
			const validAttributes = Object.values(item.system.attributes).filter(
				(attribute) => attribute.on === true
			);
			const options = validAttributes.map(
				(attribute, i) => `
				<label>
				<input type="radio" name="option" value="${attribute.name}">
				${attribute.name[0].toUpperCase() + attribute.name.slice(1)}
				</label>
			`
			);

			new this({
				title: `Rolando movimento: ${item.name}`,
				content: `
                <div class="dialog-roll-move-content">
					<div class="modifier-content">
						<label>Modificador:</label>
						<input type="text" name="modifier" placeholder="Ex: +1, +2, -1, -2">
					</div>
                    <h3>Escolha o atributo</h3>
                    <div class="options-container">
                    ${options.join("")}
                    </div>
                </div>
                `,
				buttons: {
					button1: {
						label: "+Vantagem",
						callback: (_, e) =>
							this.dialogCallback({item, resolve, e, mode: "+advantage"}),
					},
					button2: {
						label: "Vantagem",
						callback: (_, e) => this.dialogCallback({item, resolve, e, mode: "advantage"}),
					},
					button3: {
						label: "Normal",
						callback: (_, e) => this.dialogCallback({item, resolve, e, mode: "normal"}),
					},
					button4: {
						label: "Desvantagem",
						callback: (_, e) => this.dialogCallback({item, resolve, e, mode: "disadvantage"}),
					},
					button5: {
						label: "+Desvantagem",
						callback: (_, e) =>
							this.dialogCallback({item, resolve, e, mode: "+disadvantage"}),
					},
				},
                close: () => { resolve(false) }
			}).render(true);
		});
	}

    static dialogCallback({item, resolve, e, mode}){
        const options = e.target
				.closest(".window-content")
				.querySelector(".options-container")
				.querySelectorAll('[name="option"]');
			const checkedOption = [...options].find((option) => option.checked);
			if (!checkedOption) {
				ui.notifications.info(
					"Escolha um atributo para rolar com o movimento!"
				);
				return;
			}
			const chosenAttribute = checkedOption.value;
			item.moveRoll({
				mode,
				attribute: chosenAttribute,
			});
        resolve(true)
    }
}

export default RollMoveDialog
