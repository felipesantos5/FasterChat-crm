const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:8080/chat/findContacts/crm-ai', {
      where: { id: '554898136664@s.whatsapp.net' }
    }, {
      headers: {
        'apikey': 'crm-api-key-secure-202412345'
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
    
    // Also test fetchProfilePictureUrl
    const res2 = await axios.post('http://localhost:8080/chat/fetchProfilePictureUrl/crm-ai', {
      number: '554898136664@s.whatsapp.net'
    }, {
      headers: {
        'apikey': 'crm-api-key-secure-202412345'
      }
    });
    console.log("PIC URL", res2.data);
  } catch (e) {
    console.error(e.response?.data || e.message);
  }
}
test();
