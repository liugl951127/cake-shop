package com.cakeshop.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cakeshop.entity.Address;
import com.cakeshop.repository.AddressRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class AddressService extends ServiceImpl<AddressRepository, Address> {

    public List<Address> listByUser(Long userId) {
        return lambdaQuery().eq(Address::getUserId, userId)
            .orderByDesc(Address::getIsDefault)
            .orderByDesc(Address::getCreateTime).list();
    }

    public Address add(Address a) {
        if (a.getIsDefault() != null && a.getIsDefault() == 1) {
            lambdaUpdate().eq(Address::getUserId, a.getUserId())
                .set(Address::getIsDefault, 0).update();
        }
        save(a);
        return a;
    }

    public void update(Address a) {
        if (a.getIsDefault() != null && a.getIsDefault() == 1) {
            lambdaUpdate().eq(Address::getUserId, a.getUserId())
                .ne(Address::getId, a.getId())
                .set(Address::getIsDefault, 0).update();
        }
        updateById(a);
    }

    public void setDefault(Long userId, Long id) {
        lambdaUpdate().eq(Address::getUserId, userId)
            .set(Address::getIsDefault, 0).update();
        Address a = new Address();
        a.setId(id); a.setIsDefault(1);
        updateById(a);
    }
}
