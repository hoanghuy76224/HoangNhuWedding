/* Existing short invitation codes remain readable; new personalized links need no login. */
(function (root) {
  'use strict';
  var endpoint = 'https://firestore.googleapis.com/v1/projects/vo-iu-dino-848d2/databases/(default)/documents/invites_hoangnhu';
  var pattern = /^[A-Za-z0-9_-]{12}$/;
  function name(value) {
    var result = String(value || '').trim().normalize('NFC');
    if (!result || result.length > 80) throw new Error('Tên khách cần từ 1 đến 80 ký tự.');
    return result;
  }
  async function request(url, options) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 12000);
    try {
      var response = await fetch(url, Object.assign({}, options, {signal: controller.signal}));
      if (!response.ok) {
        var error = new Error(response.status === 403
          ? 'Firebase chưa cấp quyền lưu/đọc mã khách. Hãy cấu hình quyền trước khi tạo link.'
          : response.status === 404 ? 'Không tìm thấy lời mời này.' : 'Chưa kết nối được, vui lòng thử lại.');
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  root.InviteLinks = {
    async resolve(code) {
      if (!pattern.test(code)) throw new Error('Mã lời mời không hợp lệ.');
      var data = await request(endpoint + '/' + code);
      return name(data.fields && data.fields.name && data.fields.name.stringValue);
    },
    async create(value) {
      // Public personalized link: no Google account or Firestore write required.
      // Existing short ?k= links remain supported by resolve().
      var guest = name(value);
      var url = new URL(location.origin + location.pathname);
      url.searchParams.set('to', guest);
      return {name: guest, link: url.href};

    }
  };
})(window);
