export class ProviderType {
  constructor(
    public id: string,
    public name: string,
    public url: string,
    public icon: string,
    public script: string = '',
    public userAgent?: string
  ) {}

  static readonly types: ProviderType[] = [
    new ProviderType(
      'FacebookMessenger',
      'Facebook Messenger',
      'https://www.messenger.com',
      'messenger-icon.png',
      `
        // Auto-click Keep me signed in
        try {
          const persistentCheckbox = document.querySelector('input[name="persistent"][type="checkbox"]');
          if (persistentCheckbox && !persistentCheckbox.checked) {
            persistentCheckbox.click();
          }
        } catch (e) {
          // Silently ignore checkbox errors
        }

        // Function to detect if there are unread messages for Messenger
        function getUnreadFlag() {
          return !!document.querySelector("#left-sidebar-button-chats > div > div > div > div > div > div > div > div > svg");
        }
      `
    ),
    new ProviderType(
      'GoogleMessages',
      'Google Messages',
      'https://messages.google.com/web/conversations',
      'google-messages-icon.png',
      `
        // Function to check if there are unread messages for Google Messages
        function getUnreadFlag() {
          return false;
        }
      `
    ),
    new ProviderType(
      'WhatsApp',
      'WhatsApp',
      'https://web.whatsapp.com',
      'whatsapp-icon.png',
      `
        // Function to check if there are unread messages for WhatsApp
        function getUnreadFlag() {
          return false;
        }
      `,
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    )
  ]

  static getById(id: string): ProviderType | undefined {
    return this.types.find((type) => type.id === id)
  }

  static getAll(): ProviderType[] {
    return [...this.types]
  }
}
