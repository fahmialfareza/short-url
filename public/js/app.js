const app = new Vue({
   el: "#app",
   data: {
      url: "",
      slug: "",
      error: "",
      formVisible: true,
      created: null,
      loc: location.origin,
   },
   methods: {
      async createUrl() {
         this.error = "";
         if (this.checkForm()) {
            var url = this.url;
            if (!url.includes("https://") && !url.includes("http://")) {
               url = "http://" + this.url;
            }
            const response = await fetch("/url", {
               method: "POST",
               headers: {
                  "content-type": "application/json",
               },
               body: JSON.stringify({
                  url: url,
                  slug: this.slug || undefined,
               }),
            });
            if (response.ok) {
               const result = await response.json();
               this.formVisible = false;
               this.created = this.loc + "/" + result.slug;
            } else if (response.status === 429) {
               this.error =
                  "You are sending too many requests. Try again in 30 seconds.";
            } else {
               const result = await response.json();
               this.error = result.message;
            }
         }
      },
      checkForm: function () {
         this.error = "";
         if (!this.url) {
            this.error = "URL required.";
            return false;
         }
         return true;
      },
   },
});
