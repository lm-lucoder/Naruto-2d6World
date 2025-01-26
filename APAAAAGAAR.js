class SendImageDialog extends Dialog {
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
	static async create() {
		return new Promise((resolve) => {

            const content = `
            <div >
                <input type="text" id="urlImageToChatDialogInput" />
            </div>
            `
			
			new this({
				title: `Enviando imagem`,
				content,
				buttons: {
					button1: {
						label: "Enviar",
						callback: (_, e) =>
							this.dialogCallback(url),
					},
				},
                close: () => { resolve(false) }
			}).render(true);
		});
	}

    static dialogCallback(){
		const input = document.getElementById("urlImageToChatDialogInput");
        const url = input.value

        const speaker = ChatMessage.getSpeaker({ actor: this.actor });
        const label = "teste";

        ChatMessage.create({
        speaker: speaker,
        flavor: label,
        content: `<img src =${url} />`,
        });
    }
}

SendImageDialog.create()