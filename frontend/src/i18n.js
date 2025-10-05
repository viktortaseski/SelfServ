const I18N = {
    en: {
        search: "Search",
        categories: {
            coffee: "Coffee",
            drinks: "Drinks",
            food: "Food",
            desserts: "Desserts",
        },
        viewOrder: "View Order",
        supportedBySmall: "supported by",

        cart: {
            orderingFor: "Ordering for",
            myOrder: "My Order",
            pastOrders: "Past Orders",
            clearAll: "Clear All",
            clearAllConfirm: "Clear all items from your order?",
            empty: "Your cart is empty.",
            total: "Total",
            addTip: "Add Tip",
            custom: "Custom",
            addNote: "Add Note",
            notePlaceholder: "Message for the waiter",
            youMayLike: "You also may like",
            placeOrder: "Place Order",
            placing: "Placing…",
            enterTipPrompt: "Enter tip amount (MKD):",
            confirmTitle: "Confirm your order?",
            itemsAria: "Order items",
        },

        menu: {
            noItems: "No items found.",
            topPicks: "Top Picks",
        },

        orders: {
            myOrders: "My Orders",
            back: "Back",
            noPrevious: "No previous orders yet.",
            orderConfirmed: "Order Confirmed",
            awaiting: "Awaiting confirmation",
            table: "Table",
            orderId: "Order ID",
            subtotal: "Subtotal",
            tip: "Tip",
            total: "Total",
        },

        buttons: {
            cancel: "Cancel",
            confirmOrder: "Yes, order",
        },
    },

    mk: {
        search: "Пребарај",
        categories: {
            coffee: "Кафе",
            drinks: "Пијалоци",
            food: "Храна",
            desserts: "Десерти",
        },
        viewOrder: "Преглед на нарачка",
        supportedBySmall: "поддржано од",

        cart: {
            orderingFor: "Нарачувате за",
            myOrder: "Моја нарачка",
            pastOrders: "Претходни нарачки",
            clearAll: "Избриши сѐ",
            clearAllConfirm: "Да ги отстранам сите ставки од вашата нарачка?",
            empty: "Вашата кошничка е празна.",
            total: "Вкупно",
            addTip: "Додади напојница",
            custom: "По избор",
            addNote: "Додади забелешка",
            notePlaceholder: "Порака за келнерот",
            youMayLike: "Можеби ќе ви се допадне",
            placeOrder: "Нарачај",
            placing: "Се потврдува…",
            enterTipPrompt: "Внесете износ на напојница (МКД):",
            confirmTitle: "Потврдете ја нарачката?",
            itemsAria: "Артикли во нарачката",
        },

        menu: {
            noItems: "Нема пронајдени артикли.",
            topPicks: "Најпопуларни",
        },

        orders: {
            myOrders: "Мои нарачки",
            back: "Назад",
            noPrevious: "Немате претходни нарачки.",
            orderConfirmed: "Нарачката е потврдена",
            awaiting: "Се чека потврда",
            table: "Маса",
            orderId: "Број на нарачка",
            subtotal: "Меѓузбир",
            tip: "Напојница",
            total: "Вкупно",
        },

        buttons: {
            cancel: "Откажи",
            confirmOrder: "Да, нарачај",
        },
    },
};

const LANG_KEY = "lang";

export function detectLang() {
    try {
        const urlLang = new URLSearchParams(window.location.search).get("lang");
        if (urlLang && I18N[urlLang]) return urlLang;
        const saved = localStorage.getItem(LANG_KEY);
        if (saved && I18N[saved]) return saved;
    } catch { }
    return "en"; // default
}

let currentLang = detectLang();

export function setLang(l) {
    if (I18N[l]) {
        currentLang = l;
        try {
            localStorage.setItem(LANG_KEY, l);
        } catch { }
    }
}

export function getLang() {
    return currentLang;
}

export function t(path) {
    const parts = String(path).split(".");
    let node = I18N[currentLang];
    for (const p of parts) {
        if (node && Object.prototype.hasOwnProperty.call(node, p)) {
            node = node[p];
        } else {
            node = null;
            break;
        }
    }
    if (node != null) return node;

    node = I18N.en;
    for (const p of parts) {
        if (node && Object.prototype.hasOwnProperty.call(node, p)) {
            node = node[p];
        } else {
            node = path;
            break;
        }
    }
    return node ?? path;
}

export function labelForCat(key) {
    return t(`categories.${key}`);
}
